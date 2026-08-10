/* ===================================
   health management
   Shopping Cart
   - Persists cart in localStorage so it survives across pages/tabs
   - Injects a cart icon (if a page doesn't already have one) and a
     slide-in drawer, so the cart works site-wide without editing
     every page's HTML by hand
   - Checkout creates one backend Stripe Checkout Session for the whole cart
=================================== */

(function () {
    "use strict";

    var STORAGE_KEY = "hm_cart_v1";
    var LANG_KEY = "hm_lang";

    var CART_STRINGS = {
        title: { zh: "购物车", ja: "カート", ko: "장바구니" },
        empty: { zh: "您的购物车是空的。", ja: "カートは空です。", ko: "장바구니가 비어 있습니다." },
        browseMarketplace: { zh: "浏览商城", ja: "マーケットプレイスを見る", ko: "마켓플레이스 둘러보기" },
        subtotal: { zh: "小计", ja: "小計", ko: "소계" },
        note: {
            zh: "可选的健康产品购买 — 非处方药。运费和税费将在结账时计算。",
            ja: "任意のウェルネス商品購入です（処方薬ではありません）。送料・税金はチェックアウト時に計算されます。",
            ko: "선택적 웰니스 구매입니다 — 처방약이 아닙니다. 배송비 및 세금은 결제 시 계산됩니다."
        },
        remove: { zh: "移除", ja: "削除", ko: "삭제" },
        checkoutWithStripe: { zh: "使用 Stripe 结账 →", ja: "Stripeで支払う →", ko: "Stripe로 결제 →" },
        checkoutStarting: { zh: "正在跳转到安全结账…", ja: "安全な決済に移動しています…", ko: "보안 결제로 이동 중…" },
        addedToCart: { zh: "已加入购物车", ja: "をカートに追加しました", ko: "장바구니에 담았습니다" },
        each: { zh: "/件", ja: "/個", ko: "/개" }
    };

    function currentLang() {
        try {
            return window.localStorage.getItem(LANG_KEY) || "en";
        } catch (err) {
            return "en";
        }
    }

    function t(key, fallback) {
        var lang = currentLang();
        var entry = CART_STRINGS[key];
        if (entry && entry[lang]) return entry[lang];
        return fallback;
    }

    /* --------------------------------
       State
    -------------------------------- */

    function readCart() {
        try {
            var raw = window.localStorage.getItem(STORAGE_KEY);
            var items = raw ? JSON.parse(raw) : [];
            return Array.isArray(items) ? items : [];
        } catch (err) {
            return [];
        }
    }

    function writeCart(items) {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch (err) {
            /* localStorage unavailable (e.g. private browsing) — cart just won't persist */
        }
        renderAll();
    }

    function addItem(product, qty) {
        qty = qty || 1;
        var items = readCart();
        var existing = items.find(function (i) { return i.id === product.id; });

        if (existing) {
            existing.qty += qty;
        } else {
            items.push({
                id: product.id,
                name: product.name,
                price: product.price,
                icon: product.icon || "🛒",
                qty: qty
            });
        }

        writeCart(items);
    }

    function setQty(id, qty) {
        var items = readCart();
        var item = items.find(function (i) { return i.id === id; });
        if (!item) return;

        if (qty <= 0) {
            items = items.filter(function (i) { return i.id !== id; });
        } else {
            item.qty = qty;
        }

        writeCart(items);
    }

    function removeItem(id) {
        var items = readCart().filter(function (i) { return i.id !== id; });
        writeCart(items);
    }

    function clearCart() {
        writeCart([]);
    }

    function getCount(items) {
        items = items || readCart();
        return items.reduce(function (sum, i) { return sum + i.qty; }, 0);
    }

    function getSubtotal(items) {
        items = items || readCart();
        return items.reduce(function (sum, i) { return sum + i.qty * i.price; }, 0);
    }

    function formatPrice(n) {
        return "$" + n.toFixed(2);
    }

    /* --------------------------------
       Cart icon (inject if missing)
    -------------------------------- */

    function ensureCartIcon() {
        var existing = document.querySelector(".btn-cart");

        if (existing) {
            existing.setAttribute("id", existing.id || "cart-toggle-btn");
            if (!existing.querySelector(".cart-badge")) {
                var badge = document.createElement("span");
                badge.className = "cart-badge";
                badge.setAttribute("aria-hidden", "true");
                badge.textContent = "0";
                existing.appendChild(badge);
            }
            return existing;
        }

        var navContainer = document.querySelector("header .nav-container");
        if (!navContainer) return null;

        var actions = navContainer.querySelector(".nav-actions");
        var wrapper = actions;

        if (!wrapper) {
            wrapper = document.createElement("div");
            wrapper.className = "nav-actions nav-actions--injected";
            navContainer.appendChild(wrapper);
        }

        var link = document.createElement("a");
        link.href = isInSubfolder() ? "../marketplace.html" : "marketplace.html";
        link.className = "btn-cart";
        link.id = "cart-toggle-btn";
        link.setAttribute("aria-label", "Shopping cart");
        link.innerHTML = '<span aria-hidden="true">🛒</span><span class="cart-badge" aria-hidden="true">0</span>';

        wrapper.insertBefore(link, wrapper.firstChild);

        return link;
    }

    function isInSubfolder() {
        return /\/(fitness|legal)\//.test(window.location.pathname);
    }

    function assetPath(name) {
        return isInSubfolder() ? "../" + name : name;
    }

    /* --------------------------------
       Drawer (inject once)
    -------------------------------- */

    var drawerEl, overlayEl, itemsEl, subtotalEl, checkoutAreaEl, emptyEl;

    function ensureDrawer(forceRebuild) {
        if (document.getElementById("cart-drawer") && !forceRebuild) return;

        if (forceRebuild && document.getElementById("cart-drawer")) {
            document.getElementById("cart-drawer").remove();
            document.getElementById("cart-overlay").remove();
        }

        overlayEl = document.createElement("div");
        overlayEl.className = "cart-overlay";
        overlayEl.id = "cart-overlay";
        overlayEl.setAttribute("hidden", "");

        drawerEl = document.createElement("aside");
        drawerEl.className = "cart-drawer";
        drawerEl.id = "cart-drawer";
        drawerEl.setAttribute("role", "dialog");
        drawerEl.setAttribute("aria-modal", "true");
        drawerEl.setAttribute("aria-label", "Shopping cart");
        drawerEl.setAttribute("hidden", "");

        drawerEl.innerHTML =
            '<div class="cart-drawer__header">' +
                '<h2>' + t("title", "Your Cart") + '</h2>' +
                '<button type="button" class="cart-drawer__close" aria-label="Close cart">&times;</button>' +
            '</div>' +
            '<div class="cart-drawer__body">' +
                '<div class="cart-empty" id="cart-empty">' +
                    '<span aria-hidden="true">🛒</span>' +
                    '<p>' + t("empty", "Your cart is empty.") + '</p>' +
                    '<a href="' + assetPath("marketplace.html") + '" class="button button-outline">' + t("browseMarketplace", "Browse Marketplace") + '</a>' +
                '</div>' +
                '<ul class="cart-items" id="cart-items"></ul>' +
            '</div>' +
            '<div class="cart-drawer__footer" id="cart-footer">' +
                '<div class="cart-subtotal-row">' +
                    '<span>' + t("subtotal", "Subtotal") + '</span>' +
                    '<strong id="cart-subtotal">$0.00</strong>' +
                '</div>' +
                '<p class="cart-note">' + t("note", "Optional wellness purchases — not prescriptions. Shipping &amp; tax calculated at checkout.") + '</p>' +
                '<div id="cart-checkout-area"></div>' +
            '</div>';

        document.body.appendChild(overlayEl);
        document.body.appendChild(drawerEl);

        itemsEl = drawerEl.querySelector("#cart-items");
        subtotalEl = drawerEl.querySelector("#cart-subtotal");
        checkoutAreaEl = drawerEl.querySelector("#cart-checkout-area");
        emptyEl = drawerEl.querySelector("#cart-empty");

        drawerEl.querySelector(".cart-drawer__close").addEventListener("click", closeDrawer);
        overlayEl.addEventListener("click", closeDrawer);

        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && drawerEl && !drawerEl.hasAttribute("hidden")) {
                closeDrawer();
            }
        });
    }

    function openDrawer() {
        ensureDrawer();
        overlayEl.removeAttribute("hidden");
        drawerEl.removeAttribute("hidden");
        requestAnimationFrame(function () {
            overlayEl.classList.add("is-open");
            drawerEl.classList.add("is-open");
        });
        document.body.classList.add("cart-open");
    }

    function closeDrawer() {
        if (!drawerEl) return;
        overlayEl.classList.remove("is-open");
        drawerEl.classList.remove("is-open");
        document.body.classList.remove("cart-open");
        window.setTimeout(function () {
            overlayEl.setAttribute("hidden", "");
            drawerEl.setAttribute("hidden", "");
        }, 220);
    }

    /* --------------------------------
       Render
    -------------------------------- */

    function renderBadge(items) {
        var count = getCount(items);
        document.querySelectorAll(".cart-badge").forEach(function (el) {
            el.textContent = String(count);
            el.classList.toggle("cart-badge--hidden", count === 0);
        });
    }

    function renderDrawer(items) {
        if (!itemsEl) return;

        itemsEl.innerHTML = "";

        if (items.length === 0) {
            emptyEl.removeAttribute("hidden");
            document.getElementById("cart-footer").setAttribute("hidden", "");
            return;
        }

        emptyEl.setAttribute("hidden", "");
        document.getElementById("cart-footer").removeAttribute("hidden");

        items.forEach(function (item) {
            var li = document.createElement("li");
            li.className = "cart-item";
            li.innerHTML =
                '<div class="cart-item__icon" aria-hidden="true">' + item.icon + '</div>' +
                '<div class="cart-item__info">' +
                    '<span class="cart-item__name">' + escapeHtml(item.name) + '</span>' +
                    '<span class="cart-item__price">' + formatPrice(item.price) + ' ' + t("each", "each") + '</span>' +
                    '<div class="cart-item__qty">' +
                        '<button type="button" class="qty-btn" data-action="dec" aria-label="Decrease quantity">&minus;</button>' +
                        '<span aria-live="polite">' + item.qty + '</span>' +
                        '<button type="button" class="qty-btn" data-action="inc" aria-label="Increase quantity">+</button>' +
                    '</div>' +
                '</div>' +
                '<div class="cart-item__end">' +
                    '<strong>' + formatPrice(item.price * item.qty) + '</strong>' +
                    '<button type="button" class="cart-item__remove" aria-label="Remove ' + escapeHtml(item.name) + '">' + t("remove", "Remove") + '</button>' +
                '</div>';

            li.querySelector('[data-action="dec"]').addEventListener("click", function () {
                setQty(item.id, item.qty - 1);
            });
            li.querySelector('[data-action="inc"]').addEventListener("click", function () {
                setQty(item.id, item.qty + 1);
            });
            li.querySelector(".cart-item__remove").addEventListener("click", function () {
                removeItem(item.id);
            });

            itemsEl.appendChild(li);
        });

        subtotalEl.textContent = formatPrice(getSubtotal(items));
        renderCheckoutArea(items);
    }

    function renderCheckoutArea(items) {
        checkoutAreaEl.innerHTML = "";

        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "button cart-checkout-btn";
        btn.textContent = t("checkoutWithStripe", "Checkout with Stripe \u2192");
        btn.addEventListener("click", function () {
            startBackendCheckout(items, btn);
        });

        checkoutAreaEl.appendChild(btn);
    }

    function authHeaders() {
        var headers = { "Content-Type": "application/json" };
        if (typeof getToken === "function" && getToken()) {
            headers.Authorization = "Bearer " + getToken();
        }
        return headers;
    }

    async function startBackendCheckout(items, btn) {
        if (!items || items.length === 0 || typeof API_BASE === "undefined") return;

        btn.disabled = true;
        btn.textContent = t("checkoutStarting", "Redirecting to secure checkout…");

        try {
            var response = await fetch(API_BASE + "/payments/create-checkout-session", {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({
                    type: "marketplace",
                    items: items.map(function (item) {
                        return { product_id: item.id, quantity: item.qty };
                    }),
                    success_path: "/marketplace.html?checkout=success",
                    cancel_path: "/marketplace.html?checkout=canceled"
                })
            });

            var data = await response.json().catch(function () { return null; });
            if (!response.ok) {
                throw new Error(formatApiError(data && data.detail));
            }
            if (!data || !data.checkout_url) {
                throw new Error("Checkout could not be started. Please try again.");
            }
            window.location.href = data.checkout_url;
        } catch (err) {
            btn.disabled = false;
            btn.textContent = t("checkoutWithStripe", "Checkout with Stripe \u2192");
            showToast(err.message || "Checkout could not be started. Please try again.");
        }
    }

    function formatApiError(detail) {
        if (!detail) return "Checkout could not be started. Please try again.";
        if (typeof detail === "string") return detail;
        if (Array.isArray(detail)) {
            return detail.map(function (entry) { return entry.msg || entry.message || String(entry); }).join(" ");
        }
        return detail.message || String(detail);
    }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    function renderAll() {
        var items = readCart();
        renderBadge(items);
        renderDrawer(items);
    }

    /* --------------------------------
       Toast
    -------------------------------- */

    function showToast(message) {
        var toast = document.getElementById("cart-toast");

        if (!toast) {
            toast = document.createElement("div");
            toast.id = "cart-toast";
            toast.className = "cart-toast";
            toast.setAttribute("role", "status");
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.remove("is-visible");
        void toast.offsetWidth;
        toast.classList.add("is-visible");

        window.clearTimeout(toast._timer);
        toast._timer = window.setTimeout(function () {
            toast.classList.remove("is-visible");
        }, 2200);
    }

    /* --------------------------------
       Bind "Add to Cart" buttons
    -------------------------------- */

    function bindAddToCartButtons() {
        document.querySelectorAll("[data-add-to-cart]").forEach(function (btn) {
            if (btn._cartBound) return;
            btn._cartBound = true;

            btn.addEventListener("click", function () {
                var product = {
                    id: btn.getAttribute("data-id"),
                    name: btn.getAttribute("data-name"),
                    price: parseFloat(btn.getAttribute("data-price")),
                    icon: btn.getAttribute("data-icon") || "🛒"
                };

                if (!product.id || isNaN(product.price)) return;

                addItem(product, 1);
                showToast(product.name + " " + t("addedToCart", "added to cart"));

                btn.classList.add("cart-button--added");
                window.setTimeout(function () {
                    btn.classList.remove("cart-button--added");
                }, 900);
            });
        });
    }

    /* --------------------------------
       Init
    -------------------------------- */

    function init() {
        var icon = ensureCartIcon();
        ensureDrawer();
        bindAddToCartButtons();
        renderAll();

        if (icon) {
            icon.addEventListener("click", function (e) {
                e.preventDefault();
                openDrawer();
            });
        }

        // Keep badge (and drawer, if open) in sync across tabs/pages
        window.addEventListener("storage", function (e) {
            if (e.key === STORAGE_KEY) renderAll();
        });

        // Rebuild the drawer's static shell (title, labels, buttons) when
        // the language changes, since it's only built once and cached.
        document.addEventListener("hm:languagechange", function () {
            var wasOpen = drawerEl && !drawerEl.hasAttribute("hidden");
            ensureDrawer(true);
            renderAll();
            if (wasOpen) openDrawer();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    // Expose a small API in case other scripts/pages want to use it
    window.HMCart = {
        add: addItem,
        setQty: setQty,
        remove: removeItem,
        clear: clearCart,
        getItems: readCart,
        getCount: function () { return getCount(); },
        getSubtotal: function () { return getSubtotal(); },
        open: openDrawer,
        close: closeDrawer,
        rebind: bindAddToCartButtons
    };
})();
