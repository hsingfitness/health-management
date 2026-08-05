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

    const VIEW_CONTENT_TEXT = { zh: "查看内容", ja: "コンテンツを見る", ko: "콘텐츠 보기" };
    const LOCKED_TEXT = { zh: "购买后解锁", ja: "購入後に解除", ko: "구매 후 잠금 해제" };

    function viewContentText() {
        return VIEW_CONTENT_TEXT[currentLang()] || "View Content";
    }

    function lockedText() {
        return LOCKED_TEXT[currentLang()] || "Unlocks after purchase";
    }

    function renderCard(p) {
        const badges = (p.badges || [])
            .map((b) => `<span class="badge ${badgeClass(b)}">${escapeHtml(badgeText(b))}</span>`)
            .join("");

        const isDigital = p.content_type === "digital_text";
        const lockedRow = isDigital
            ? `<div class="product-card__locked">
                    <span class="product-card__locked-label">🔒 ${escapeHtml(lockedText())}</span>
                    <button class="product-card__unlock-btn" type="button" data-view-content data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}">
                        ${escapeHtml(viewContentText())}
                    </button>
                </div>`
            : "";

        return `
            <article class="product-card" data-category="${escapeHtml(p.category)}">
                <div class="product-card__top">
                    <div class="product-icon" aria-hidden="true">${escapeHtml(p.icon)}</div>
                    <div class="product-badges">${badges}</div>
                </div>
                <h3>${escapeHtml(p.name)}</h3>
                <p>${escapeHtml(p.description)}</p>
                ${lockedRow}
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

    /* ---- Locked digital content modal ---- */

    function ensureContentModal() {
        let modal = document.getElementById("hm-content-modal");
        if (modal) return modal;

        modal = document.createElement("div");
        modal.id = "hm-content-modal";
        modal.className = "hm-content-modal";
        modal.hidden = true;
        modal.innerHTML = `
            <div class="hm-content-modal__backdrop" data-close-content-modal></div>
            <div class="hm-content-modal__box" role="dialog" aria-modal="true">
                <button type="button" class="hm-content-modal__close" data-close-content-modal aria-label="Close">&times;</button>
                <h3 id="hm-content-modal-title"></h3>
                <div id="hm-content-modal-body" class="hm-content-modal__body"></div>
            </div>`;
        document.body.appendChild(modal);

        modal.querySelectorAll("[data-close-content-modal]").forEach((el) => {
            el.addEventListener("click", () => { modal.hidden = true; });
        });

        return modal;
    }

    function showContentModal(title, bodyHtml) {
        const modal = ensureContentModal();
        modal.querySelector("#hm-content-modal-title").textContent = title;
        modal.querySelector("#hm-content-modal-body").innerHTML = bodyHtml;
        modal.hidden = false;
    }

    async function handleViewContent(id, name) {
        if (typeof isLoggedIn !== "function" || !isLoggedIn()) {
            const redirectTarget = "marketplace.html";
            window.location.href = "login.html?redirect=" + encodeURIComponent(redirectTarget);
            return;
        }

        try {
            const response = await fetch(API_BASE + "/products/" + encodeURIComponent(id) + "/content", {
                headers: { Authorization: "Bearer " + getToken() }
            });

            if (response.status === 403) {
                showContentModal(
                    name,
                    `<p class="hm-content-modal__locked">🔒 Purchase this product to unlock its content. Add it to your cart and complete checkout, then come back and click "${escapeHtml(viewContentText())}" again.</p>`
                );
                return;
            }

            if (!response.ok) {
                showContentModal(name, `<p class="hm-content-modal__locked">Something went wrong loading this content. Please try again later.</p>`);
                return;
            }

            const data = await response.json();
            showContentModal(name, `<div class="hm-content-modal__text">${escapeHtml(data.content || "")}</div>`);
        } catch (err) {
            showContentModal(name, `<p class="hm-content-modal__locked">Can't reach the server right now. Please try again later.</p>`);
        }
    }

    function wireViewContentButtons() {
        document.querySelectorAll("[data-view-content]").forEach((btn) => {
            if (btn._contentBound) return;
            btn._contentBound = true;
            btn.addEventListener("click", () => {
                handleViewContent(btn.dataset.id, btn.dataset.name);
            });
        });
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

    const CATEGORY_NAME_TEXT = {
        all: { zh: "全部商品", ja: "すべての商品", ko: "전체 상품" },
        "heart-health": { zh: "心脏健康", ja: "心臓の健康", ko: "심장 건강" },
        "brain-health": { zh: "大脑健康", ja: "脳の健康", ko: "두뇌 건강" },
        "digestive-health": { zh: "消化健康", ja: "消化の健康", ko: "소화 건강" },
        "immune-health": { zh: "免疫健康", ja: "免疫の健康", ko: "면역 건강" },
        "sleep": { zh: "睡眠", ja: "睡眠", ko: "수면" },
        "energy": { zh: "精力", ja: "エネルギー", ko: "에너지" },
        "bone-joint": { zh: "骨骼与关节", ja: "骨と関節", ko: "뼈 및 관절" },
        "weight-management": { zh: "体重管理", ja: "体重管理", ko: "체중 관리" },
        "healthy-foods": { zh: "健康食品", ja: "ヘルシーフード", ko: "건강식품" }
    };

    function categoryLabel(id, fallbackName) {
        const lang = currentLang();
        const entry = CATEGORY_NAME_TEXT[id];
        return entry && entry[lang] ? entry[lang] : fallbackName;
    }

    function renderCategoryPills(categories) {
        const container = document.querySelector(".category-tabs");
        if (!container || !Array.isArray(categories)) return;

        const pillsHtml = categories
            .map(
                (c) =>
                    `<button class="category-pill" type="button" data-category="${escapeHtml(c.id)}">
                        <span aria-hidden="true">${escapeHtml(c.icon)}</span> ${escapeHtml(categoryLabel(c.id, c.name))}
                    </button>`
            )
            .join("");

        container.innerHTML =
            `<button class="category-pill category-pill--active" type="button" data-category="all">${escapeHtml(categoryLabel("all", "All Products"))}</button>` +
            pillsHtml;
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

    async function loadCategories() {
        if (typeof API_BASE === "undefined") return;
        try {
            const response = await fetch(API_BASE + "/categories");
            if (!response.ok) return;
            const categories = await response.json();
            if (Array.isArray(categories) && categories.length) {
                renderCategoryPills(categories);
            }
        } catch (err) {
            // backend unreachable — keep the static fallback pills already in the HTML
        }
    }

    async function loadProducts() {
        wireCategoryFilters();
        await loadCategories();
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
        wireViewContentButtons();
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
