/* =========================================================
   Health Management — Marketplace
   Loads products from the backend (in the current language) so
   admin/operator edits made in the Admin Dashboard actually show
   up here, and re-fetches/re-renders live when the language
   changes. If the backend isn't reachable, the static English
   cards already in the HTML stay put.
========================================================= */

(function () {
    "use strict";

    const LANG_KEY = "hm_lang";

    const BADGE_CLASS = {
        "Best Seller": "badge--gold",
        "Popular": "badge--purple",
        "New": "badge--blue",
        "Top Rated": "badge--green",
        "Chef's Pick": "badge--green"
    };

    // Small fixed vocabulary of badge labels reused across products —
    // translated here rather than per-product, since they're not
    // product-specific content.
    const BADGE_TEXT = {
        "Best Seller": { zh: "畅销", ja: "ベストセラー", ko: "베스트셀러" },
        "Optional": { zh: "可选", ja: "任意", ko: "선택" },
        "Popular": { zh: "热门", ja: "人気", ko: "인기" },
        "New": { zh: "新品", ja: "新商品", ko: "신상품" },
        "Top Rated": { zh: "好评优选", ja: "高評価", ko: "평점 우수" },
        "Chef's Pick": { zh: "主厨推荐", ja: "シェフのおすすめ", ko: "셰프 추천" }
    };

    const ADD_TO_CART_TEXT = { zh: "加入购物车", ja: "カートに追加", ko: "장바구니에 담기" };
    const ITEM_UNIT = { zh: "件", ja: "件", ko: "개" };

    function currentLang() {
        try {
            return window.localStorage.getItem(LANG_KEY) || "en";
        } catch (err) {
            return "en";
        }
    }

    function badgeText(text) {
        const lang = currentLang();
        const entry = BADGE_TEXT[text];
        return entry && entry[lang] ? entry[lang] : text;
    }

    function addToCartText() {
        const lang = currentLang();
        return ADD_TO_CART_TEXT[lang] || "Add to Cart";
    }

    function badgeClass(text) {
        return BADGE_CLASS[text] || "badge--muted";
    }

    function escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str == null ? "" : String(str);
        return div.innerHTML;
    }

    function renderCard(p) {
        const badges = (p.badges || [])
            .map((b) => `<span class="badge ${badgeClass(b)}">${escapeHtml(badgeText(b))}</span>`)
            .join("");

        return `
            <article class="product-card" data-category="${escapeHtml(p.category)}">
                <div class="product-card__top">
                    <div class="product-icon" aria-hidden="true">${escapeHtml(p.icon)}</div>
                    <div class="product-badges">${badges}</div>
                </div>
                <h3>${escapeHtml(p.name)}</h3>
                <p>${escapeHtml(p.description)}</p>
                <div class="product-card__footer">
                    <strong>$${Number(p.price).toFixed(2)}</strong>
                    <button class="cart-button" type="button" data-add-to-cart
                        data-id="${escapeHtml(p.id)}"
                        data-name="${escapeHtml(p.name)}"
                        data-price="${p.price}"
                        data-icon="${escapeHtml(p.icon)}">
                        <span aria-hidden="true">🛒</span> ${escapeHtml(addToCartText())}
                    </button>
                </div>
            </article>`;
    }

    function updateItemCount(n) {
        const el = document.querySelector(".item-count");
        if (!el) return;

        const lang = currentLang();
        if (lang === "en" || !ITEM_UNIT[lang]) {
            el.textContent = n + (n === 1 ? " item" : " items");
        } else {
            el.textContent = n + ITEM_UNIT[lang];
        }
    }

    function activeCategory() {
        const active = document.querySelector(".category-pill--active");
        return active ? active.dataset.category : "all";
    }

    function applyCategoryFilter() {
        const category = activeCategory();
        const cards = document.querySelectorAll(".product-card");
        let visible = 0;

        cards.forEach((card) => {
            const match = category === "all" || card.dataset.category === category;
            card.style.display = match ? "" : "none";
            if (match) visible++;
        });

        updateItemCount(visible);
    }

    function wireCategoryFilters() {
        const pills = document.querySelectorAll(".category-pill");
        if (!pills.length) return;

        pills.forEach((pill) => {
            if (pill._filterBound) return;
            pill._filterBound = true;

            pill.addEventListener("click", () => {
                pills.forEach((p) => p.classList.remove("category-pill--active"));
                pill.classList.add("category-pill--active");
                applyCategoryFilter();
            });
        });
    }

    async function loadProducts() {
        wireCategoryFilters();

        const grid = document.querySelector(".product-grid");
        if (!grid || typeof API_BASE === "undefined") return;

        let products;
        try {
            const response = await fetch(API_BASE + "/products?lang=" + encodeURIComponent(currentLang()));
            if (!response.ok) return;
            products = await response.json();
        } catch (err) {
            return; // backend unreachable — keep the static fallback cards
        }

        if (!Array.isArray(products) || products.length === 0) return;

        grid.innerHTML = products.map(renderCard).join("");
        wireCategoryFilters();
        applyCategoryFilter();

        if (window.HMCart && typeof window.HMCart.rebind === "function") {
            window.HMCart.rebind();
        }
    }

    document.addEventListener("DOMContentLoaded", loadProducts);

    // Re-fetch in the new language and re-render whenever the user
    // switches language, so product names/descriptions/badges/buttons
    // all update live without needing a page reload.
    document.addEventListener("hm:languagechange", loadProducts);
})();
