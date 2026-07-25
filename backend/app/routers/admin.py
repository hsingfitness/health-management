from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user, require_permission, require_role
from ..models import Order, Report, User
from ..schemas import (
    ALLOWED_PERMISSIONS,
    AdminOrderOut,
    AdminReportOut,
    DeliveryStatusUpdate,
    OperatorCreate,
    OperatorOut,
    OperatorPermissionsUpdate,
)
from ..security import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


def _clean_permissions(permissions: dict) -> dict:
    return {k: bool(v) for k, v in permissions.items() if k in ALLOWED_PERMISSIONS}


@router.get("/operators", response_model=list[OperatorOut])
def list_operators(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("super_admin")),
):
    operators = (
        db.query(User)
        .filter(User.role.in_(["operator", "super_admin"]))
        .order_by(User.created_at.asc())
        .all()
    )
    return operators


@router.post("/operators", response_model=OperatorOut, status_code=status.HTTP_201_CREATED)
def create_operator(
    payload: OperatorCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("super_admin")),
):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this email already exists.")

    operator = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role="operator",
        permissions=_clean_permissions(payload.permissions),
    )
    db.add(operator)
    db.commit()
    db.refresh(operator)
    return operator


@router.patch("/operators/{operator_id}", response_model=OperatorOut)
def update_operator_permissions(
    operator_id: str,
    payload: OperatorPermissionsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("super_admin")),
):
    operator = db.query(User).filter(User.id == operator_id).first()
    if not operator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operator not found.")
    if operator.role == "super_admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Super admin permissions can't be edited here.")

    operator.permissions = _clean_permissions(payload.permissions)
    db.commit()
    db.refresh(operator)
    return operator


@router.delete("/operators/{operator_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_operator(
    operator_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("super_admin")),
):
    if str(operator_id) == str(current_user.id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't remove your own admin access.")

    operator = db.query(User).filter(User.id == operator_id).first()
    if not operator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Operator not found.")
    if operator.role == "super_admin":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can't remove another super admin from here.")

    # Demote back to a regular user rather than deleting the account outright,
    # so their order/report history is preserved.
    operator.role = "user"
    operator.permissions = {}
    db.commit()


# ---------- Order fulfillment (manage_orders permission) ----------

@router.get("/orders", response_model=list[AdminOrderOut])
def list_all_orders(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_permission("manage_orders")),
):
    orders = db.query(Order).order_by(Order.created_at.desc()).all()
    customers = {
        u.id: u for u in db.query(User).filter(User.id.in_([o.user_id for o in orders if o.user_id])).all()
    }

    return [
        AdminOrderOut(
            id=str(o.id),
            customer_name=customers[o.user_id].name if o.user_id in customers else None,
            customer_email=customers[o.user_id].email if o.user_id in customers else None,
            items=o.items,
            amount_total=float(o.amount_total),
            currency=o.currency,
            status=o.status,
            delivery_status=o.delivery_status,
            created_at=o.created_at,
        )
        for o in orders
    ]


@router.patch("/orders/{order_id}/delivery", response_model=AdminOrderOut)
def update_delivery_status(
    order_id: str,
    payload: DeliveryStatusUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_permission("manage_orders")),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found.")

    order.delivery_status = payload.delivery_status
    db.commit()
    db.refresh(order)

    customer = db.query(User).filter(User.id == order.user_id).first() if order.user_id else None

    return AdminOrderOut(
        id=str(order.id),
        customer_name=customer.name if customer else None,
        customer_email=customer.email if customer else None,
        items=order.items,
        amount_total=float(order.amount_total),
        currency=order.currency,
        status=order.status,
        delivery_status=order.delivery_status,
        created_at=order.created_at,
    )


# ---------- Assessment report review (view_reports permission) ----------

@router.get("/reports", response_model=list[AdminReportOut])
def list_all_reports(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_permission("view_reports")),
):
    reports = db.query(Report).order_by(Report.created_at.desc()).all()
    customers = {
        u.id: u for u in db.query(User).filter(User.id.in_([r.user_id for r in reports if r.user_id])).all()
    }

    return [
        AdminReportOut(
            id=str(r.id),
            customer_name=customers[r.user_id].name if r.user_id in customers else None,
            customer_email=customers[r.user_id].email if r.user_id in customers else None,
            input=r.input,
            summary=r.output.get("summary", ""),
            risk_level=r.output.get("risk_level", ""),
            recommendations=r.output.get("recommendations", []),
            tier=r.output.get("tier", "free"),
            created_at=r.created_at,
        )
        for r in reports
    ]
