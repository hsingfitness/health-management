/* ===================================
   health management
   Shopping Cart
   - Persists cart in localStorage so it survives across pages/tabs
   - Injects a cart icon (if a page doesn't already have one) and a
     slide-in drawer, so the cart works site-wide without editing
     every page's HTML by hand
   - Checkout hands off to Stripe Payment Links (see js/stripe-links.js)
=================================== */

(function () {
    "use strict";

    var STORAGE_KEY = "hm_cart_v1";

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

    function ensureDrawer() {
        if (document.getElementById("cart-drawer")) return;

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
                '<h2>Your Cart</h2>' +
                '<button type="button" class="cart-drawer__close" aria-label="Close cart">&times;</button>' +
            '</div>' +
            '<div class="cart-drawer__body">' +
                '<div class="cart-empty" id="cart-empty">' +
                    '<span aria-hidden="true">🛒</span>' +
                    '<p>Your cart is empty.</p>' +
                    '<a href="' + assetPath("marketplace.html") + '" class="button button-outline">Browse Marketplace</a>' +
                '</div>' +
                '<ul class="cart-items" id="cart-items"></ul>' +
            '</div>' +
            '<div class="cart-drawer__footer" id="cart-footer">' +
                '<div class="cart-subtotal-row">' +
                    '<span>Subtotal</span>' +
                    '<strong id="cart-subtotal">$0.00</strong>' +
                '</div>' +
                '<p class="cart-note">Optional wellness purchases — not prescriptions. Shipping &amp; tax calculated at checkout.</p>' +
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
                    '<span class="cart-item__price">' + formatPrice(item.price) + ' each</span>' +
                    '<div class="cart-item__qty">' +
                        '<button type="button" class="qty-btn" data-action="dec" aria-label="Decrease quantity">&minus;</button>' +
                        '<span aria-live="polite">' + item.qty + '</span>' +
                        '<button type="button" class="qty-btn" data-action="inc" aria-label="Increase quantity">+</button>' +
                    '</div>' +
                '</div>' +
                '<div class="cart-item__end">' +
                    '<strong>' + formatPrice(item.price * item.qty) + '</strong>' +
                    '<button type="button" class="cart-item__remove" aria-label="Remove ' + escapeHtml(item.name) + '">Remove</button>' +
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
        var links = window.STRIPE_PAYMENT_LINKS || {};
        var distinctIds = Array.from(new Set(items.map(function (i) { return i.id; })));

        if (distinctIds.length === 1) {
            var only = items[0];
            var link = links[only.id];

            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "button cart-checkout-btn";

            if (link) {
                btn.textContent = "Checkout with Stripe \u2192";
                btn.addEventListener("click", function () {
                    window.location.href = link;
                });
            } else {
                btn.textContent = "Checkout not set up yet";
                btn.disabled = true;
                btn.title = "This product doesn't have a Stripe Payment Link configured yet.";
            }

            checkoutAreaEl.appendChild(btn);
            return;
        }

        // Multiple distinct products: no backend to combine into one Stripe
        // session, so offer a separate secure checkout per product.
        var note = document.createElement("p");
        note.className = "cart-note cart-note--split";
        note.textContent = "You have items from multiple products. Since checkout is powered by Stripe Payment Links, please complete a quick secure payment for each product below:";
        checkoutAreaEl.appendChild(note);

        items.forEach(function (item) {
            var link = links[item.id];
            var row = document.createElement("button");
            row.type = "button";
            row.className = "button button-outline cart-checkout-row";

            if (link) {
                row.textContent = "Pay for " + item.name + " (\u00d7" + item.qty + ") \u2014 " + formatPrice(item.price * item.qty);
                row.addEventListener("click", function () {
                    window.open(link, "_blank", "noopener");
                });
            } else {
                row.textContent = item.name + " \u2014 checkout not set up yet";
                row.disabled = true;
            }

            checkoutAreaEl.appendChild(row);
        });
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
                showToast(product.name + " added to cart");

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
        close: closeDrawer
    };
})();
