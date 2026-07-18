/* ===================================
   Stripe Payment Links configuration
   ===================================

   HOW TO SET THIS UP (no coding needed):

   1. Create a Stripe account at https://dashboard.stripe.com/register
   2. In the Stripe Dashboard, go to Product Catalog and add a product
      for each item below (same name/price as on the site).
   3. For each product, click "Create payment link".
      - Under "Options", turn ON "Adjustable quantity" so customers can
        buy more than one.
      - Under "After payment", you can set a custom confirmation page —
        point it at your site, e.g. https://hsingfitness.github.io/health-management/checkout-success.html
   4. Copy the generated link (looks like https://buy.stripe.com/xxxxxxxx)
      and paste it as the value for the matching product id below.
   5. Commit and push — checkout will start working for that product
      immediately, no other code changes needed.

   Products left as "" will show a friendly "not available yet" message
   at checkout instead of a broken link.

   NOTE ON MULTI-ITEM CARTS:
   Each Stripe Payment Link checks out ONE product at a time. Since this
   site has no backend/database, a cart containing several different
   products can't be combined into a single Stripe payment — the cart
   drawer will instead let the customer pay for each distinct product
   separately (each opens its own secure Stripe Checkout page). If you
   later want a single combined checkout for mixed carts, that requires
   a small backend (e.g. a Cloudflare Worker or Vercel function) that
   creates a Stripe Checkout Session server-side with all line items —
   ask me and I can help you set that up when you're ready.
*/

window.STRIPE_PAYMENT_LINKS = {
    "omega-3-fish-oil": "",
    "vitamin-d3-5000iu": "",
    "zinc-selenium-complex": "",
    "vegan-protein-blend": "",
    "magnesium-glycinate-400mg": "",
    "organic-ashwagandha": "",
    "ginseng-root-extract": "",
    "turmeric-curcumin-95": "",
    "milk-thistle-liver-support": ""
};
