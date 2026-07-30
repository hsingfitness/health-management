from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import require_permission
from ..models import Product, User
from ..schemas import AdminProductOut, ProductCreate, ProductOut, ProductUpdate

router = APIRouter(tags=["products"])

SUPPORTED_LANGUAGES = ("en", "zh", "ja", "ko")


def resolve_text(i18n: dict, lang: str) -> str:
    """Pick the requested language, falling back to English, falling
    back to whatever's there if even English is missing."""
    if not i18n:
        return ""
    if lang in i18n and i18n[lang]:
        return i18n[lang]
    if i18n.get("en"):
        return i18n["en"]
    return next(iter(i18n.values()), "")


def to_product_out(product: Product, lang: str) -> ProductOut:
    return ProductOut(
        id=product.id,
        name=resolve_text(product.name_i18n, lang) or product.name,
        description=resolve_text(product.description_i18n, lang) or product.description,
        price=float(product.price),
        category=product.category,
        icon=product.icon,
        badges=product.badges or [],
        stripe_payment_link=product.stripe_payment_link,
        is_active=product.is_active,
        sort_order=product.sort_order,
    )


@router.get("/products", response_model=list[ProductOut])
def list_products(
    db: Session = Depends(get_db),
    lang: str = Query("en", description="en | zh | ja | ko"),
):
    """Public: active products only, for the marketplace page. Name and
    description come back already resolved to the requested language
    (falls back to English if that language's translation is missing)."""
    lang = lang if lang in SUPPORTED_LANGUAGES else "en"

    products = (
        db.query(Product)
        .filter(Product.is_active.is_(True))
        .order_by(Product.sort_order.asc(), Product.created_at.asc())
        .all()
    )
    return [to_product_out(p, lang) for p in products]


@router.get("/admin/products", response_model=list[AdminProductOut])
def list_all_products(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_permission("manage_products")),
):
    """Admin: every product, including inactive ones, with every
    language's text so the dashboard can edit them all."""
    products = db.query(Product).order_by(Product.sort_order.asc(), Product.created_at.asc()).all()
    return products


@router.post("/admin/products", response_model=AdminProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_permission("manage_products")),
):
    if db.query(Product).filter(Product.id == payload.id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A product with this ID already exists.")

    data = payload.model_dump()
    # Keep the legacy plain-text columns populated too (English, for
    # backward compatibility / anything not yet using name_i18n).
    data["name"] = data["name_i18n"].get("en") or next(iter(data["name_i18n"].values()), "")
    data["description"] = data["description_i18n"].get("en") or next(iter(data["description_i18n"].values()), "")

    product = Product(**data)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/admin/products/{product_id}", response_model=AdminProductOut)
def update_product(
    product_id: str,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_permission("manage_products")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    updates = payload.model_dump(exclude_unset=True)

    if "name_i18n" in updates:
        product.name = updates["name_i18n"].get("en") or product.name
    if "description_i18n" in updates:
        product.description = updates["description_i18n"].get("en") or product.description

    for field, value in updates.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/admin/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_permission("manage_products")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

    db.delete(product)
    db.commit()
