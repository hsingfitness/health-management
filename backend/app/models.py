import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Numeric, JSON, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID

from .database import Base, engine


def _uuid_default():
    return str(uuid.uuid4())


# UUID type that also works on SQLite (used for local dev) by falling back to String.
def uuid_column():
    if engine.dialect.name == "postgresql":
        return Column(UUID(as_uuid=False), primary_key=True, default=_uuid_default)
    return Column(String(36), primary_key=True, default=_uuid_default)


def fk_user_column():
    if engine.dialect.name == "postgresql":
        return Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    return Column(String(36), ForeignKey("users.id"), nullable=True)


class User(Base):
    __tablename__ = "users"

    id = uuid_column()
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    # Admin role: "user" (default) | "operator" | "super_admin"
    role = Column(String(20), nullable=False, default="user")
    # Assessment tier, purchased one-off via Stripe: "free" | "member" | "vip"
    plan = Column(String(20), nullable=False, default="free")
    # Granular grants for operators, e.g. {"manage_products": true}.
    # super_admin ignores this and always has full access.
    permissions = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)


class Product(Base):
    __tablename__ = "products"

    id = Column(String(80), primary_key=True)  # human-readable slug, e.g. "omega-3-fish-oil"
    name = Column(String(200), nullable=False)  # legacy English-only column, kept for backward compat
    description = Column(String(500), nullable=False, default="")  # legacy English-only column
    # {"en": "...", "zh": "...", "ja": "...", "ko": "..."} -- missing languages fall back to "en"
    name_i18n = Column(JSON, nullable=False, default=dict)
    description_i18n = Column(JSON, nullable=False, default=dict)
    price = Column(Numeric(10, 2), nullable=False)
    category = Column(String(40), nullable=False, default="heart-health")
    icon = Column(String(10), nullable=False, default="💊")
    badges = Column(JSON, nullable=False, default=list)  # e.g. ["Best Seller", "Optional"]
    stripe_payment_link = Column(String(500), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    # "physical" (default) or "digital_text". Digital-text products show a
    # locked preview on the marketplace; the actual `digital_content` text
    # is only served to a buyer once they have a paid order for this product.
    content_type = Column(String(20), nullable=False, default="physical")
    digital_content = Column(String(20000), nullable=True)
    # Internal admin-only notes (supplier info, restock reminders, etc.).
    # Never included in any public-facing schema — see AdminProductOut vs
    # ProductOut in schemas.py.
    internal_notes = Column(String(2000), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Category(Base):
    __tablename__ = "categories"

    id = Column(String(40), primary_key=True)  # slug, e.g. "devices"
    name = Column(String(80), nullable=False)  # display name, e.g. "Devices"
    icon = Column(String(10), nullable=False, default="🏷")
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Order(Base):
    __tablename__ = "orders"

    id = uuid_column()
    user_id = fk_user_column()
    items = Column(JSON, nullable=False)  # [{id, name, price, qty}]
    amount_total = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(10), default="usd")
    stripe_session_id = Column(String(255), unique=True, nullable=True)
    status = Column(String(20), default="pending")  # pending -> paid | canceled
    # Order fulfillment, separate from payment status: "pending" -> "shipped" -> "delivered"
    delivery_status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"

    id = uuid_column()
    user_id = fk_user_column()  # nullable: guests can generate reports too, just can't retrieve history
    input = Column(JSON, nullable=False)  # {symptom_details, breakfast, lunch, dinner, sleep}
    output = Column(JSON, nullable=False)  # {summary, risk_level, recommendations, disclaimer}
    created_at = Column(DateTime, default=datetime.utcnow)
