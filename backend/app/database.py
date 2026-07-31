import json

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

from .config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Columns that have been added to models after the table may already have
# existed in a deployed database. Base.metadata.create_all() only creates
# whole tables that are missing — it never alters an existing table — so
# without this, a deployed DB from before one of these fields existed would
# be stuck permanently missing it (breaking login/signup with a DB error)
# until someone manually ran an ALTER TABLE. This runs it automatically,
# safely, on every startup instead.
COLUMN_MIGRATIONS = {
    "users": [
        ("role", "VARCHAR(20) NOT NULL DEFAULT 'user'"),
        ("plan", "VARCHAR(20) NOT NULL DEFAULT 'free'"),
        ("permissions", "JSON NOT NULL DEFAULT '{}'"),
    ],
    "orders": [
        ("delivery_status", "VARCHAR(20) NOT NULL DEFAULT 'pending'"),
    ],
    "products": [
        ("name_i18n", "JSON NOT NULL DEFAULT '{}'"),
        ("description_i18n", "JSON NOT NULL DEFAULT '{}'"),
        ("content_type", "VARCHAR(20) NOT NULL DEFAULT 'physical'"),
        ("digital_content", "VARCHAR(20000)"),
    ],
}


def run_column_migrations() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table, columns in COLUMN_MIGRATIONS.items():
            if table not in existing_tables:
                continue  # brand-new DB: create_all() already made it with every column

            existing_columns = {c["name"] for c in inspector.get_columns(table)}

            for name, ddl_type in columns:
                if name in existing_columns:
                    continue
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl_type}"))


def run_data_backfills() -> None:
    """One-time data fixes that go beyond adding a column with a static
    default -- e.g. copying an existing plain-English value into the new
    per-language JSON field so nothing goes blank after the migration
    above runs. Safe to call every startup: only touches rows that still
    need it."""
    inspector = inspect(engine)
    if "products" not in inspector.get_table_names():
        return

    with engine.begin() as conn:
        rows = conn.execute(text("SELECT id, name, description, name_i18n, description_i18n FROM products")).fetchall()

        for row in rows:
            name_i18n = row.name_i18n or {}
            description_i18n = row.description_i18n or {}

            if isinstance(name_i18n, str):
                name_i18n = json.loads(name_i18n) if name_i18n else {}
            if isinstance(description_i18n, str):
                description_i18n = json.loads(description_i18n) if description_i18n else {}

            changed = False
            if not name_i18n and row.name:
                name_i18n = {"en": row.name}
                changed = True
            if not description_i18n and row.description:
                description_i18n = {"en": row.description}
                changed = True

            if changed:
                conn.execute(
                    text("UPDATE products SET name_i18n = :n, description_i18n = :d WHERE id = :id"),
                    {"n": json.dumps(name_i18n), "d": json.dumps(description_i18n), "id": row.id},
                )
