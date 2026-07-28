/* =========================================================
   Health Management — Assessment Paywall
   The form is always visible immediately on Member/VIP pages.
   Payment is only checked when the user clicks Submit: if they
   haven't paid for this tier yet, we save their form answers,
   send them to login (if needed) then Stripe Checkout, and
   auto-submit their saved answers once payment is confirmed.
========================================================= */

(function () {
    "use strict";

    const PLAN_PRICES = { member: 200, vip: 100 };
    const PLAN_NAMES = {
        member: "Member Health Dashboard — One-off unlock",
        vip: "VIP Personalized Risk Model — Upgrade"
    };
    const PLAN_RANK = { free: 0, member: 1, vip: 2 };
    const PENDING_KEY = "hm_pending_assessment";

    function qs(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    function requiredTier() {
        // A dedicated page (assessment_member.html, assessment_vip.html) can
        // just declare its tier directly: <body data-tier="member">.
        // Falls back to ?unlock=member for the old single-page flow.
        return document.body.dataset.tier || qs("unlock");
    }

    function clearQueryParams() {
        const url = new URL(window.location.href);
        url.search = "";
        window.history.replaceState({}, "", url.toString());
    }

    function el(id) {
        return document.getElementById(id);
    }

    function showGate(message, showHomeLink) {
        el("assessment-gate").hidden = false;
        el("assessment-gate-message").textContent = message;
        el("assessment-gate-home-link").hidden = !showHomeLink;
        el("assessment-form").hidden = true;

        const debug = el("assessment-gate-debug");
        if (debug) {
            debug.textContent = "URL: " + window.location.pathname + window.location.search;
        }

        window.clearTimeout(showGate._timer);
        showGate._timer = window.setTimeout(function () {
            const homeLink = el("assessment-gate-home-link");
            if (homeLink && !el("assessment-gate").hidden) {
                homeLink.hidden = false;
            }
        }, 6000);
    }

    function hideGate() {
        if (!el("assessment-gate")) return;
        el("assessment-gate").hidden = true;
        el("assessment-form").hidden = false;
    }

    function withTimeout(promise, ms) {
        return Promise.race([
            promise,
            new Promise(function (_, reject) {
                window.setTimeout(function () { reject(new Error("timeout")); }, ms);
            })
        ]);
    }

    function planLabel(plan) {
        if (plan === "vip") return "✦ VIP Personalized Analysis unlocked";
        if (plan === "member") return "✦ Member Customized Analysis unlocked";
        return null;
    }

    function showTierBadge(plan) {
        const badge = el("assessment-tier-badge");
        if (!badge) return;
        const label = planLabel(plan);
        if (label) {
            badge.hidden = false;
            el("assessment-tier-label").textContent = label;
        } else {
            badge.hidden = true;
        }
    }

    async function authedRequest(path, options) {
        options = options || {};
        const headers = Object.assign(
            { "Content-Type": "application/json" },
            options.headers || {},
            { Authorization: "Bearer " + getToken() }
        );
        return apiRequest(path, Object.assign({}, options, { headers }));
    }

    async function refreshUser() {
        try {
            const me = await authedRequest("/auth/me");
            saveSession(getToken(), me);
            return me;
        } catch (err) {
            return null;
        }
    }

    function savePendingFormData(form) {
        const fields = ["symptom_details", "breakfast", "lunch", "dinner", "sleep"];
        const data = {};
        fields.forEach(function (name) {
            data[name] = form[name] ? form[name].value : "";
        });
        sessionStorage.setItem(PENDING_KEY, JSON.stringify(data));
    }

    function restorePendingFormData(form) {
        const raw = sessionStorage.getItem(PENDING_KEY);
        if (!raw) return false;
        sessionStorage.removeItem(PENDING_KEY);
        try {
            const data = JSON.parse(raw);
            Object.keys(data).forEach(function (name) {
                if (form[name]) form[name].value = data[name];
            });
            return true;
        } catch (err) {
            return false;
        }
    }

    async function startCheckout(plan, currentPage, form) {
        if (form) savePendingFormData(form);
        showGate("Redirecting you to secure checkout…", false);
        try {
            const successPath = document.body.dataset.tier
                ? "/" + currentPage
                : "/" + currentPage + "?unlock=" + plan;

            const data = await authedRequest("/payments/create-checkout-session", {
                method: "POST",
                body: JSON.stringify({
                    items: [{ id: "plan-" + plan, name: PLAN_NAMES[plan], price: PLAN_PRICES[plan], qty: 1 }],
                    success_path: successPath,
                    cancel_path: "/" + currentPage
                })
            });
            window.location.href = data.checkout_url;
        } catch (err) {
            showGate(err.message || "Couldn't start checkout. Please try again.", true);
        }
    }

    async function verifyOrderAndUnlock(orderId, tier) {
        const form = el("assessment-form");
        showGate("Confirming your payment…", false);
        try {
            const order = await authedRequest("/payments/orders/" + orderId + "/verify", { method: "POST" });

            if (order.status !== "paid") {
                showGate(
                    "We couldn't confirm your payment yet. If you completed checkout, please wait a moment and refresh this page.",
                    true
                );
                return;
            }

            const me = await refreshUser();
            clearQueryParams();
            hideGate();
            showTierBadge(me ? me.plan : tier);

            const restored = form && restorePendingFormData(form);
            if (restored && form.requestSubmit) {
                form.requestSubmit();
            }
        } catch (err) {
            showGate(err.message || "Couldn't confirm your payment.", true);
        }
    }

    /* ---------------------------------------------------------
       Called by assessment.js right when the Submit button is
       clicked, before it talks to the report-generation API.
       Returns true => go ahead and generate the report now.
       Returns false => access is being handled (redirecting to
       login or Stripe); assessment.js should stop and wait.
    --------------------------------------------------------- */
    window.checkAssessmentAccess = async function (form) {
        const tier = requiredTier();
        const currentPage = window.location.pathname.split("/").pop() || "assessment.html";

        if (!tier || tier === "free") return true;

        if (typeof isLoggedIn !== "function" || !isLoggedIn()) {
            savePendingFormData(form);
            const redirectTarget = document.body.dataset.tier
                ? currentPage
                : currentPage + "?unlock=" + encodeURIComponent(tier);
            window.location.href = "login.html?redirect=" + encodeURIComponent(redirectTarget);
            return false;
        }

        let me;
        try {
            me = await withTimeout(refreshUser(), 20000);
        } catch (err) {
            if (typeof showAssessmentError === "function") {
                showAssessmentError(
                    "The server is taking a while to respond (it may be waking up from being idle). Please try again in a moment."
                );
            }
            return false;
        }

        if (me && (PLAN_RANK[me.plan] || 0) >= (PLAN_RANK[tier] || 0)) {
            showTierBadge(me.plan);
            return true;
        }

        await startCheckout(tier, currentPage, form);
        return false;
    };

    async function init() {
        const form = el("assessment-form");
        if (!form) return;

        const tier = requiredTier();
        const orderId = qs("order");

        showTierBadge(tier === "free" ? null : tier);

        if (orderId && tier && tier !== "free") {
            if (typeof isLoggedIn === "function" && isLoggedIn()) {
                await verifyOrderAndUnlock(orderId, tier);
            } else {
                clearQueryParams();
            }
        }
    }

    document.addEventListener("DOMContentLoaded", init);
})();
