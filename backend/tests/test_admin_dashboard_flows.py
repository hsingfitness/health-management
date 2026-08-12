import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

TEST_DB = Path(__file__).with_name("admin_dashboard_test.sqlite")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ.setdefault("JWT_SECRET", "test-secret")

from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Order, Product, Report, User
from app.security import create_access_token, hash_password

client = TestClient(app)


def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def auth_headers(user_id):
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def create_admin(db, **kwargs):
    admin = User(
        name=kwargs.get("name", "Admin User"),
        email=kwargs.get("email", "admin@example.com"),
        password_hash=hash_password("password123"),
        role=kwargs.get("role", "super_admin"),
        permissions=kwargs.get("permissions", {}),
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def test_categories_crud_and_delete_guard_use_real_rows():
    reset_db()
    with SessionLocal() as db:
        admin = create_admin(db)
        db.add(
            Product(
                id="existing-device",
                name="Existing Device",
                description="Already assigned to devices.",
                name_i18n={"en": "Existing Device"},
                description_i18n={"en": "Already assigned to devices."},
                price=29.99,
                category="devices",
                icon="⌚",
            )
        )
        db.commit()
        headers = auth_headers(admin.id)

    create_response = client.post(
        "/api/admin/categories",
        json={"id": "devices", "name": "Devices", "icon": "⌚", "sort_order": 10},
        headers=headers,
    )
    assert create_response.status_code == 201
    assert create_response.json()["name"] == "Devices"

    list_response = client.get("/api/categories")
    assert list_response.status_code == 200
    assert any(category["id"] == "devices" for category in list_response.json())

    update_response = client.put(
        "/api/admin/categories/devices",
        json={"name": "Smart Devices", "icon": "📟", "sort_order": 3},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json() == {
        "id": "devices",
        "name": "Smart Devices",
        "icon": "📟",
        "sort_order": 3,
    }

    blocked_delete = client.delete("/api/admin/categories/devices", headers=headers)
    assert blocked_delete.status_code == 400
    assert "product(s) still use it" in blocked_delete.json()["detail"]

    with SessionLocal() as db:
        db.query(Product).filter(Product.id == "existing-device").delete()
        db.commit()

    delete_response = client.delete("/api/admin/categories/devices", headers=headers)
    assert delete_response.status_code == 204
    assert all(category["id"] != "devices" for category in client.get("/api/categories").json())


def test_orders_tab_lists_real_orders_and_updates_delivery_status():
    reset_db()
    with SessionLocal() as db:
        admin = create_admin(db, role="operator", permissions={"manage_reports": True})
        customer = User(
            name="Customer One",
            email="customer@example.com",
            password_hash=hash_password("password123"),
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        order = Order(
            user_id=customer.id,
            items=[{"id": "omega-3", "name": "Omega 3", "qty": 2, "price": 19.99}],
            amount_total=39.98,
            currency="usd",
            status="paid",
            delivery_status="pending",
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        headers = auth_headers(admin.id)
        order_id = order.id

    list_response = client.get("/api/admin/orders", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json()[0]["customer_email"] == "customer@example.com"
    assert list_response.json()[0]["items"][0]["name"] == "Omega 3"

    update_response = client.patch(
        f"/api/admin/orders/{order_id}/delivery",
        json={"delivery_status": "shipped"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.json()["delivery_status"] == "shipped"


def test_reports_tab_lists_real_reports_with_customer_and_detail_payload():
    reset_db()
    with SessionLocal() as db:
        admin = create_admin(db, role="operator", permissions={"manage_reports": True})
        customer = User(
            name="Report Customer",
            email="report@example.com",
            password_hash=hash_password("password123"),
        )
        db.add(customer)
        db.commit()
        db.refresh(customer)
        report = Report(
            user_id=customer.id,
            input={
                "symptom_details": "Tired after lunch",
                "breakfast": "Oats",
                "lunch": "Salad",
                "dinner": "Soup",
                "sleep": "7 hours",
            },
            output={
                "summary": "Stable report summary",
                "risk_level": "low",
                "recommendations": ["Hydrate", "Walk after lunch"],
                "tier": "vip",
            },
        )
        db.add(report)
        db.commit()
        headers = auth_headers(admin.id)

    response = client.get("/api/admin/reports", headers=headers)
    assert response.status_code == 200
    payload = response.json()[0]
    assert payload["customer_email"] == "report@example.com"
    assert payload["input"]["symptom_details"] == "Tired after lunch"
    assert payload["summary"] == "Stable report summary"
    assert payload["recommendations"] == ["Hydrate", "Walk after lunch"]
    assert payload["tier"] == "vip"
