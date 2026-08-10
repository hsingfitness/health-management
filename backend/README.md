# Health Management API

FastAPI backend for the Health Management site. Currently provides
signup/login (JWT-based), Stripe checkout, and rule-based assessment report generation.

## Endpoints

| Method | Path             | Auth required | Description                          |
|--------|------------------|----------------|--------------------------------------|
| GET    | `/`              | no             | Health check                         |
| POST   | `/api/auth/signup` | no           | Create an account, returns a token   |
| POST   | `/api/auth/login`  | no           | Log in, returns a token              |
| GET    | `/api/auth/me`     | yes (Bearer) | Return the current user              |
| POST   | `/api/payments/create-checkout-session` | optional | Create a Stripe Checkout Session for the cart; returns a `checkout_url` to redirect to. Works for guests too — attaches the order to the logged-in user if a token is sent. |
| POST   | `/api/payments/webhook` | no (Stripe-signed) | Stripe calls this when a payment completes; marks the matching order as `paid`. |
| GET    | `/api/payments/orders` | yes (Bearer) | List the current user's past orders. |
| POST   | `/api/reports/generate` | optional | Generate a rule-based wellness report from the assessment form. Saves to history if logged in. |
| GET    | `/api/reports` | yes (Bearer) | List the current user's past reports. |

`signup` and `login` both return:
```json
{
  "access_token": "...",
  "token_type": "bearer",
  "user": { "name": "...", "email": "..." }
}
```
This matches what `js/auth.js` in the frontend already expects.

## Local development

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # defaults to a local SQLite file, no Supabase needed yet
uvicorn app.main:app --reload
```

Visit `http://localhost:8000/docs` for interactive API docs (Swagger UI) —
useful for testing signup/login without touching the frontend at all.

## Setting up Supabase (Postgres)

1. Create a project at supabase.com (free tier is fine to start).
2. Go to **Project Settings → Database → Connection string → URI**. Copy it —
   this is your `DATABASE_URL`. Use the **Session pooler** connection string
   if deploying to Render (Render's free tier works better with pooled
   connections than a direct connection).
3. Either:
   - Let the backend create the `users` table automatically on first startup
     (it calls `Base.metadata.create_all` in `main.py`), **or**
   - Paste `schema.sql` into the Supabase SQL Editor and run it yourself.
4. Set `DATABASE_URL` as an environment variable wherever you deploy.

## Setting up Stripe

1. Create a Stripe account, grab your **secret key** from the Stripe Dashboard
   (Developers → API keys). Set it as `STRIPE_SECRET_KEY`.
2. Once deployed, register a webhook endpoint in the Stripe Dashboard
   pointing at `https://your-api.onrender.com/api/payments/webhook`,
   listening for the `checkout.session.completed` event. Stripe will give
   you a signing secret — set that as `STRIPE_WEBHOOK_SECRET`.
3. Set `FRONTEND_ORIGINS` to your real site URL (not `*`) — the checkout
   success/cancel redirect URLs are built from the first origin in that
   list.

The frontend cart drawer now calls `POST /api/payments/create-checkout-session`
with `{ "type": "marketplace", "items": [{ "product_id": "omega-3-fish-oil", "quantity": 2 }] }`.
The backend validates active products, server-side prices, and configured
Stripe Price IDs, then creates one combined Checkout Session for the whole cart.

## Deploying to Render

The simplest path is the manual one below. (There's also a `render.yaml` in
this folder for Render's Blueprint flow, if you'd rather point Render at
that directly — Render's Blueprint UI lets you specify a custom file path,
in which case use `backend/render.yaml`.)

1. Push this repo to GitHub (already done — this folder is `backend/` inside
   the same repo as the frontend).
2. In Render: **New → Web Service → connect this GitHub repo**.
3. Set the **Root Directory** to `backend`.
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   (Render sets `$PORT` automatically.)
6. Add environment variables (from `.env.example`):
   - `DATABASE_URL` — your Supabase connection string
   - `JWT_SECRET` — generate one with `openssl rand -hex 32`
   - `FRONTEND_ORIGINS` — your deployed frontend URL(s), comma-separated
     (e.g. `https://yourname.github.io`). Using `*` works for testing but
     should be locked down before going live.
7. Deploy. Render will give you a URL like
   `https://health-management-api.onrender.com`.

## Connecting the frontend

Once deployed, open `js/auth.js` in the frontend repo and update:

```js
const API_BASE = "https://health-management-api.onrender.com/api";
```

That's the only change needed — signup/login on the site should work
immediately after that, since the frontend was already built against this
exact API contract.

Note: Render's free tier spins down after inactivity, so the first request
after a while can take 30–60 seconds to wake up. That's expected.


## Marketplace Stripe Price IDs

Marketplace checkout requires `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_<PRODUCT_ID_WITH_UNDERSCORES_IN_UPPERCASE>` for each product (for example `STRIPE_PRICE_OMEGA_3_FISH_OIL`). The frontend never sends prices or Stripe Price IDs.


### Default marketplace product → Stripe Price ID mapping

| Product ID | Environment variable |
|---|---|
| `omega-3-fish-oil` | `STRIPE_PRICE_OMEGA_3_FISH_OIL` |
| `vitamin-d3-5000iu` | `STRIPE_PRICE_VITAMIN_D3_5000IU` |
| `zinc-selenium-complex` | `STRIPE_PRICE_ZINC_SELENIUM_COMPLEX` |
| `vegan-protein-blend` | `STRIPE_PRICE_VEGAN_PROTEIN_BLEND` |
| `magnesium-glycinate-400mg` | `STRIPE_PRICE_MAGNESIUM_GLYCINATE_400MG` |
| `organic-ashwagandha` | `STRIPE_PRICE_ORGANIC_ASHWAGANDHA` |
| `ginseng-root-extract` | `STRIPE_PRICE_GINSENG_ROOT_EXTRACT` |
| `turmeric-curcumin-95` | `STRIPE_PRICE_TURMERIC_CURCUMIN_95` |
| `milk-thistle-liver-support` | `STRIPE_PRICE_MILK_THISTLE_LIVER_SUPPORT` |
| `smart-blood-pressure-monitor` | `STRIPE_PRICE_SMART_BLOOD_PRESSURE_MONITOR` |
| `continuous-glucose-tracker` | `STRIPE_PRICE_CONTINUOUS_GLUCOSE_TRACKER` |
| `sleep-quality-sensor` | `STRIPE_PRICE_SLEEP_QUALITY_SENSOR` |
| `body-composition-scale` | `STRIPE_PRICE_BODY_COMPOSITION_SCALE` |
| `high-protein-chicken-bowl` | `STRIPE_PRICE_HIGH_PROTEIN_CHICKEN_BOWL` |
| `keto-meal-plan-weekly` | `STRIPE_PRICE_KETO_MEAL_PLAN_WEEKLY` |
| `organic-vegetable-box` | `STRIPE_PRICE_ORGANIC_VEGETABLE_BOX` |
| `low-sugar-dessert-pack` | `STRIPE_PRICE_LOW_SUGAR_DESSERT_PACK` |
| `aromatherapy-diffuser-kit` | `STRIPE_PRICE_AROMATHERAPY_DIFFUSER_KIT` |
| `sleep-sound-machine` | `STRIPE_PRICE_SLEEP_SOUND_MACHINE` |
| `guided-meditation-app-1yr` | `STRIPE_PRICE_GUIDED_MEDITATION_APP_1YR` |
| `stress-relief-journal-set` | `STRIPE_PRICE_STRESS_RELIEF_JOURNAL_SET` |
