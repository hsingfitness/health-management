import secrets

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..deps import get_current_user, get_current_user_optional
from ..models import Order, Product, User
from ..schemas import CheckoutRequest, CheckoutResponse, OrderOut

router = APIRouter(prefix="/payments", tags=["payments"])

PLAN_PRODUCT_IDS = {"plan-member": "member", "plan-vip": "vip"}
PLAN_PRICES = {"plan-member": 200.00, "plan-vip": 100.00}
PLAN_NAMES = {
    "plan-member": "Member Health Dashboard — One-off unlock",
    "plan-vip": "VIP Personalized Risk Model — Upgrade",
}
MAX_MARKETPLACE_QUANTITY = 99


def _frontend_base_url() -> str:
    origins = settings.FRONTEND_ORIGINS.strip()
    if origins in ("", "*"):
        return "http://localhost:8080"
    return origins.split(",")[0].strip().rstrip("/")


def _with_order_params(path: str, order: Order) -> str:
    path = path if path.startswith("/") else "/" + path
    joiner = "&" if "?" in path else "?"
    token_part = f"&token={order.access_token}" if order.access_token else ""
    return f"{path}{joiner}order={order.id}{token_part}"


def _plan_checkout(payload: CheckoutRequest, current_user: User | None):
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please log in before purchasing a plan.")

    plan_items = [item for item in payload.items if item.id in PLAN_PRODUCT_IDS]
    if len(plan_items) != len(payload.items) or len(plan_items) != 1 or plan_items[0].qty != 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Plan checkout supports one plan item at a time.")

    item = plan_items[0]
    price = PLAN_PRICES[item.id]
    name = PLAN_NAMES[item.id]
    return {
        "purchase_type": "plan",
        "order_items": [{"id": item.id, "name": name, "price": price, "qty": 1, "type": "plan"}],
        "line_items": [{
            "price_data": {
                "currency": "usd",
                "product_data": {"name": name},
                "unit_amount": round(price * 100),
            },
            "quantity": 1,
        }],
        "amount_total": price,
        "currency": "usd",
    }


def _marketplace_checkout(payload: CheckoutRequest, db: Session):
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart must contain at least one item.")

    quantities: dict[str, int] = {}
    for item in payload.items:
        product_id = item.product_id or item.id
        quantity = item.quantity if item.quantity is not None else item.qty
        if not product_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Each item requires product_id.")
        if not isinstance(quantity, int) or quantity <= 0 or quantity > MAX_MARKETPLACE_QUANTITY:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Quantity must be an integer from 1 to 99.")
        quantities[product_id] = quantities.get(product_id, 0) + quantity
        if quantities[product_id] > MAX_MARKETPLACE_QUANTITY:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Quantity must be an integer from 1 to 99.")

    products = db.query(Product).filter(Product.id.in_(quantities.keys())).all()
    by_id = {p.id: p for p in products}
    missing = [pid for pid in quantities if pid not in by_id]
    if missing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown product_id: {missing[0]}")

    line_items = []
    order_items = []
    amount_total = 0.0
    for product_id, quantity in quantities.items():
        product = by_id[product_id]
        if not product.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Product is not active: {product_id}")
        if not product.stripe_price_id:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"Stripe Price ID is not configured for product: {product_id}")
        unit_price = float(product.price)
        order_items.append({
            "id": product.id,
            "product_id": product.id,
            "name": product.name,
            "price": unit_price,
            "qty": quantity,
            "quantity": quantity,
            "type": "marketplace",
        })
        line_items.append({"price": product.stripe_price_id, "quantity": quantity})
        amount_total += unit_price * quantity

    return {
        "purchase_type": "marketplace",
        "order_items": order_items,
        "line_items": line_items,
        "amount_total": amount_total,
        "currency": "usd",
    }


@router.post("/create-checkout-session", response_model=CheckoutResponse)
def create_checkout_session(
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Payments aren't configured yet. Set STRIPE_SECRET_KEY on the server.")

    purchase_type = (payload.type or "").lower()
    has_plan_item = any((item.product_id or item.id) in PLAN_PRODUCT_IDS for item in payload.items)
    if purchase_type in ("member", "vip", "plan") or has_plan_item:
        checkout = _plan_checkout(payload, current_user)
    elif purchase_type in ("", "marketplace"):
        checkout = _marketplace_checkout(payload, db)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported checkout type.")

    stripe.api_key = settings.STRIPE_SECRET_KEY
    base_url = _frontend_base_url()
    order = Order(
        user_id=str(current_user.id) if current_user else None,
        items=checkout["order_items"],
        amount_total=checkout["amount_total"],
        currency=checkout["currency"],
        status="pending",
        access_token=secrets.token_urlsafe(32),
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    try:
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=checkout["line_items"],
            success_url=f"{base_url}{_with_order_params(payload.success_path, order)}",
            cancel_url=f"{base_url}{payload.cancel_path if payload.cancel_path.startswith('/') else '/' + payload.cancel_path}",
            metadata={"order_id": str(order.id), "purchase_type": checkout["purchase_type"]},
        )
    except stripe.error.StripeError as e:
        db.delete(order)
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    order.stripe_session_id = session.id
    db.commit()
    return CheckoutResponse(checkout_url=session.url, order_id=str(order.id), order_access_token=order.access_token)


def _finalize_order(order: Order, db: Session, session: dict | None = None) -> None:
    if order.status == "paid":
        return
    order.status = "paid"
    if session:
        payment_intent = session.get("payment_intent")
        if payment_intent:
            order.stripe_payment_intent_id = payment_intent if isinstance(payment_intent, str) else payment_intent.get("id")
    plan_ids = [PLAN_PRODUCT_IDS[i["id"]] for i in (order.items or []) if i.get("id") in PLAN_PRODUCT_IDS]
    if plan_ids and order.user_id:
        user = db.query(User).filter(User.id == order.user_id).first()
        if user:
            new_plan = "vip" if "vip" in plan_ids else "member"
            if new_plan == "vip" or user.plan != "vip":
                user.plan = new_plan
    db.commit()


@router.post("/orders/{order_id}/verify", response_model=OrderOut)
def verify_order(order_id: str, request: Request, db: Session = Depends(get_db), current_user: User | None = Depends(get_current_user_optional)):
    order = db.query(Order).filter(Order.id == order_id).first()
    token = request.query_params.get("token") or request.headers.get("x-order-access-token")
    owns_order = order and current_user and order.user_id == str(current_user.id)
    has_token = order and order.access_token and token and secrets.compare_digest(order.access_token, token)
    if not order or not (owns_order or has_token):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    if order.status != "paid" and order.stripe_session_id and settings.STRIPE_SECRET_KEY:
        stripe.api_key = settings.STRIPE_SECRET_KEY
        try:
            session = stripe.checkout.Session.retrieve(order.stripe_session_id)
            if session.get("payment_status") == "paid":
                _finalize_order(order, db, session)
        except stripe.error.StripeError:
            pass

    return OrderOut(id=str(order.id), items=order.items, amount_total=float(order.amount_total), currency=order.currency, status=order.status, delivery_status=order.delivery_status, created_at=order.created_at)


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Webhook not configured.")
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature.")
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        order = db.query(Order).filter(Order.stripe_session_id == session["id"]).first()
        if order:
            _finalize_order(order, db, session)
    return {"received": True}


@router.get("/orders", response_model=list[OrderOut])
def list_my_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    orders = db.query(Order).filter(Order.user_id == str(current_user.id)).order_by(Order.created_at.desc()).all()
    return [OrderOut(id=str(o.id), items=o.items, amount_total=float(o.amount_total), currency=o.currency, status=o.status, delivery_status=o.delivery_status, created_at=o.created_at) for o in orders]
