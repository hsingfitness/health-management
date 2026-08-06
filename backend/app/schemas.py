from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str = "user"
    plan: str = "free"
    permissions: dict = Field(default_factory=dict)

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class CheckoutItem(BaseModel):
    id: str
    name: str
    price: float = Field(gt=0)
    qty: int = Field(gt=0, le=99)


class CheckoutRequest(BaseModel):
    items: list[CheckoutItem] = Field(min_length=1)
    # Where to send the browser after Stripe Checkout. Defaults to the cart
    # page (marketplace orders); the assessment paywall passes its own.
    success_path: str = "/cart.html?checkout=success"
    cancel_path: str = "/cart.html?checkout=canceled"


class CheckoutResponse(BaseModel):
    checkout_url: str


class OrderOut(BaseModel):
    id: str
    items: list[dict]
    amount_total: float
    currency: str
    status: str
    delivery_status: str = "pending"
    created_at: datetime

    class Config:
        from_attributes = True


class ReportRequest(BaseModel):
    symptom_details: str = Field(min_length=1, max_length=4000)
    breakfast: str = Field(default="", max_length=300)
    lunch: str = Field(default="", max_length=300)
    dinner: str = Field(default="", max_length=300)
    sleep: str = Field(default="", max_length=300)


class ReportOut(BaseModel):
    id: str
    summary: str
    risk_level: str
    recommendations: list[str]
    disclaimer: str
    tier: str = "free"
    created_at: datetime


# ---------- Marketplace products ----------

class ProductOut(BaseModel):
    """Public shape: name/description already resolved to one language
    (with English fallback) by the endpoint, not read directly off the
    ORM object. Note: digital_content is deliberately NOT included here —
    it's only ever returned by the unlock endpoint, and only to a buyer
    who has a paid order for this product."""
    id: str
    name: str
    description: str
    price: float
    category: str
    icon: str
    badges: list[str]
    stripe_payment_link: str | None = None
    is_active: bool
    sort_order: int
    content_type: str = "physical"


class AdminProductOut(BaseModel):
    """Admin shape: every language's text, for editing in the dashboard.
    Includes the digital_content text itself since admins need to edit it,
    and internal_notes — an admin-only field that must never appear in
    ProductOut (the public shape) above."""
    id: str
    name_i18n: dict[str, str]
    description_i18n: dict[str, str]
    price: float
    category: str
    icon: str
    badges: list[str]
    stripe_payment_link: str | None = None
    is_active: bool
    sort_order: int
    content_type: str = "physical"
    digital_content: str | None = None
    internal_notes: str | None = None

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    name_i18n: dict[str, str] = Field(min_length=1)  # must have at least one language, ideally "en"
    description_i18n: dict[str, str] = Field(default_factory=dict)
    price: float = Field(gt=0)
    category: str = Field(default="heart-health", max_length=40)
    icon: str = Field(default="💊", max_length=10)
    badges: list[str] = Field(default_factory=list)
    stripe_payment_link: str | None = None
    is_active: bool = True
    sort_order: int = 0
    content_type: str = Field(default="physical", pattern=r"^(physical|digital_text)$")
    digital_content: str | None = Field(default=None, max_length=20000)
    internal_notes: str | None = Field(default=None, max_length=2000)


class ProductUpdate(BaseModel):
    name_i18n: dict[str, str] | None = None
    description_i18n: dict[str, str] | None = None
    price: float | None = Field(default=None, gt=0)
    category: str | None = Field(default=None, max_length=40)
    icon: str | None = Field(default=None, max_length=10)
    badges: list[str] | None = None
    stripe_payment_link: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None
    content_type: str | None = Field(default=None, pattern=r"^(physical|digital_text)$")
    digital_content: str | None = Field(default=None, max_length=20000)
    internal_notes: str | None = Field(default=None, max_length=2000)


# ---------- Categories ----------

class CategoryOut(BaseModel):
    id: str
    name: str
    icon: str
    sort_order: int

    class Config:
        from_attributes = True


class CategoryCreate(BaseModel):
    id: str = Field(min_length=1, max_length=40, pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$")
    name: str = Field(min_length=1, max_length=80)
    icon: str = Field(default="🏷", max_length=10)
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    icon: str | None = Field(default=None, max_length=10)
    sort_order: int | None = None


# ---------- Admin: operator management ----------

ALLOWED_PERMISSIONS = ["manage_products", "manage_reports"]


class OperatorOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    permissions: dict
    created_at: datetime

    class Config:
        from_attributes = True


class OperatorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    permissions: dict[str, bool] = Field(default_factory=dict)


class OperatorPermissionsUpdate(BaseModel):
    permissions: dict[str, bool]


# ---------- Admin: order fulfillment ----------

class AdminOrderOut(BaseModel):
    id: str
    customer_name: str | None = None
    customer_email: str | None = None
    items: list[dict]
    amount_total: float
    currency: str
    status: str
    delivery_status: str
    created_at: datetime


ALLOWED_DELIVERY_STATUSES = ["pending", "shipped", "delivered", "canceled"]


class DeliveryStatusUpdate(BaseModel):
    delivery_status: str = Field(pattern="^(pending|shipped|delivered|canceled)$")


# ---------- Admin: report review ----------

class AdminReportOut(BaseModel):
    id: str
    customer_name: str | None = None
    customer_email: str | None = None
    input: dict
    summary: str
    risk_level: str
    recommendations: list[str]
    tier: str
    created_at: datetime
