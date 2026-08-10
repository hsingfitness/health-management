from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, SessionLocal, engine, run_column_migrations, run_data_backfills
from .routers import admin, auth, categories, contact, payments, products, reports
from .seed import reorganize_into_health_goals, seed_categories, seed_products

# Creates tables if they don't exist yet. Fine for this project's current size;
# swap for Alembic migrations later if the schema grows.
Base.metadata.create_all(bind=engine)

# Adds any columns that were added to a model after the table already
# existed in a deployed database (create_all() above only creates whole
# missing tables, never alters existing ones).
run_column_migrations()
run_data_backfills()

with SessionLocal() as _db:
    seed_categories(_db)
    seed_products(_db)
    reorganize_into_health_goals(_db)

app = FastAPI(title="Health Management API")

origins = (
    ["*"]
    if settings.FRONTEND_ORIGINS.strip() == "*"
    else [o.strip() for o in settings.FRONTEND_ORIGINS.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(contact.router, prefix="/api")


@app.get("/")
def health_check():
    return {"status": "ok"}


@app.get("/api/status")
def integration_status():
    """
    Reports which optional integrations have credentials configured,
    without ever exposing the actual secret values. Useful for diagnosing
    'it should be set but the server says it isn't' issues.
    """
    return {
        "database": bool(settings.DATABASE_URL and not settings.DATABASE_URL.startswith("sqlite")),
        "gemini_configured": bool(settings.GEMINI_API_KEY),
        "stripe_configured": bool(settings.STRIPE_SECRET_KEY),
        "stripe_webhook_configured": bool(settings.STRIPE_WEBHOOK_SECRET),
        "gmail_address_set": bool(settings.GMAIL_ADDRESS),
        "gmail_address_value_preview": (
            settings.GMAIL_ADDRESS[:3] + "***" + settings.GMAIL_ADDRESS[-8:]
            if settings.GMAIL_ADDRESS and "@" in settings.GMAIL_ADDRESS
            else None
        ),
        "gmail_app_password_set": bool(settings.GMAIL_APP_PASSWORD),
        "gmail_app_password_length": len(settings.GMAIL_APP_PASSWORD) if settings.GMAIL_APP_PASSWORD else 0,
    }
