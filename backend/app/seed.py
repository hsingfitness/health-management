import os

from sqlalchemy.orm import Session

from .models import Category, Product

# Mirrors the products originally hard-coded into marketplace.html, so
# switching the page over to the API doesn't change what shoppers see.
# Once this seed runs once, super admins/operators manage products via
# the /admin/products API (and the admin.html dashboard) instead.
#
# name/description are kept as plain English for backward compatibility;
# name_i18n/description_i18n carry the real per-language content and are
# what the API actually serves.
DEFAULT_PRODUCTS = [
    dict(
        id="omega-3-fish-oil", name="Premium Omega-3 Fish Oil",
        description="High DHA/EPA for cognitive function and joint health.",
        name_i18n={
            "en": "Premium Omega-3 Fish Oil", "zh": "特级Omega-3鱼油",
            "ja": "プレミアムオメガ3フィッシュオイル", "ko": "프리미엄 오메가-3 피시 오일",
        },
        description_i18n={
            "en": "High DHA/EPA for cognitive function and joint health.",
            "zh": "富含DHA/EPA，有益认知功能和关节健康。",
            "ja": "認知機能と関節の健康に役立つ高DHA/EPA配合。",
            "ko": "인지 기능과 관절 건강에 도움이 되는 고함량 DHA/EPA.",
        },
        price=28.99, category="heart-health", icon="💊",
        badges=["Best Seller", "Optional"], sort_order=1,
    ),
    dict(
        id="vitamin-d3-5000iu", name="Vitamin D3 5000 IU",
        description="Enhanced absorption formula for bone and immune support.",
        name_i18n={
            "en": "Vitamin D3 5000 IU", "zh": "维生素D3 5000国际单位",
            "ja": "ビタミンD3 5000IU", "ko": "비타민 D3 5000IU",
        },
        description_i18n={
            "en": "Enhanced absorption formula for bone and immune support.",
            "zh": "强化吸收配方，支持骨骼和免疫健康。",
            "ja": "骨と免疫をサポートする吸収力強化フォーミュラ。",
            "ko": "뼈와 면역 건강을 위한 흡수력 강화 포뮬러.",
        },
        price=18.99, category="immune-health", icon="💊",
        badges=["Optional"], sort_order=2,
    ),
    dict(
        id="zinc-selenium-complex", name="Zinc + Selenium Complex",
        description="Advanced immune system support formula.",
        name_i18n={
            "en": "Zinc + Selenium Complex", "zh": "锌硒复合片",
            "ja": "亜鉛+セレン複合サプリ", "ko": "아연 + 셀레늄 복합제",
        },
        description_i18n={
            "en": "Advanced immune system support formula.",
            "zh": "先进的免疫系统支持配方。",
            "ja": "高度な免疫サポートフォーミュラ。",
            "ko": "고급 면역 시스템 지원 포뮬러.",
        },
        price=22.99, category="immune-health", icon="💊",
        badges=["Popular", "Optional"], sort_order=3,
    ),
    dict(
        id="vegan-protein-blend", name="Vegan Protein Blend",
        description="Clean plant-based protein with digestive enzymes.",
        name_i18n={
            "en": "Vegan Protein Blend", "zh": "纯素蛋白粉",
            "ja": "ヴィーガンプロテインブレンド", "ko": "비건 프로틴 블렌드",
        },
        description_i18n={
            "en": "Clean plant-based protein with digestive enzymes.",
            "zh": "纯净植物蛋白，添加消化酶。",
            "ja": "消化酵素配合のクリーンな植物性プロテイン。",
            "ko": "소화 효소가 함유된 깨끗한 식물성 단백질.",
        },
        price=39.99, category="weight-management", icon="🌿",
        badges=["Optional"], sort_order=4,
    ),
    dict(
        id="magnesium-glycinate-400mg", name="Magnesium Glycinate 400mg",
        description="Supports muscle relaxation, sleep, and nervous system health.",
        name_i18n={
            "en": "Magnesium Glycinate 400mg", "zh": "甘氨酸镁400毫克",
            "ja": "マグネシウムグリシネート400mg", "ko": "마그네슘 글리시네이트 400mg",
        },
        description_i18n={
            "en": "Supports muscle relaxation, sleep, and nervous system health.",
            "zh": "有助于放松肌肉、改善睡眠和神经系统健康。",
            "ja": "筋肉の弛緩、睡眠、神経系の健康をサポート。",
            "ko": "근육 이완, 수면, 신경계 건강을 지원합니다.",
        },
        price=24.99, category="sleep", icon="🌿",
        badges=["New", "Optional"], sort_order=5,
    ),
    dict(
        id="organic-ashwagandha", name="Organic Ashwagandha",
        description="Adaptogenic herb to manage cortisol and stress response.",
        name_i18n={
            "en": "Organic Ashwagandha", "zh": "有机南非醉茄",
            "ja": "オーガニックアシュワガンダ", "ko": "유기농 아쉬와간다",
        },
        description_i18n={
            "en": "Adaptogenic herb to manage cortisol and stress response.",
            "zh": "适应原草本，帮助调节皮质醇和压力反应。",
            "ja": "コルチゾールとストレス反応を整えるアダプトゲンハーブ。",
            "ko": "코르티솔과 스트레스 반응을 조절하는 적응성 허브.",
        },
        price=26.99, category="energy", icon="🌿",
        badges=["Top Rated", "Optional"], sort_order=6,
    ),
    dict(
        id="ginseng-root-extract", name="Ginseng Root Extract",
        description="Traditional herb for energy and vitality enhancement.",
        name_i18n={
            "en": "Ginseng Root Extract", "zh": "人参根提取物",
            "ja": "高麗人参根エキス", "ko": "인삼 뿌리 추출물",
        },
        description_i18n={
            "en": "Traditional herb for energy and vitality enhancement.",
            "zh": "传统草本，增强精力与活力。",
            "ja": "エネルギーと活力を高める伝統的なハーブ。",
            "ko": "에너지와 활력을 증진시키는 전통 허브.",
        },
        price=32.99, category="energy", icon="🌿",
        badges=["Optional"], sort_order=7,
    ),
    dict(
        id="turmeric-curcumin-95", name="Turmeric Curcumin 95%",
        description="Anti-inflammatory properties from premium turmeric extract.",
        name_i18n={
            "en": "Turmeric Curcumin 95%", "zh": "姜黄素95%",
            "ja": "ターメリッククルクミン95%", "ko": "강황 커큐민 95%",
        },
        description_i18n={
            "en": "Anti-inflammatory properties from premium turmeric extract.",
            "zh": "优质姜黄提取物，具有抗炎特性。",
            "ja": "プレミアムターメリック抽出物による抗炎症作用。",
            "ko": "프리미엄 강황 추출물의 항염 효과.",
        },
        price=21.99, category="bone-joint", icon="🌿",
        badges=["Optional"], sort_order=8,
    ),
    dict(
        id="milk-thistle-liver-support", name="Milk Thistle Liver Support",
        description="Natural liver detoxification and protection.",
        name_i18n={
            "en": "Milk Thistle Liver Support", "zh": "奶蓟护肝片",
            "ja": "ミルクシスル肝臓サポート", "ko": "밀크씨슬 간 건강 지원",
        },
        description_i18n={
            "en": "Natural liver detoxification and protection.",
            "zh": "天然护肝解毒。",
            "ja": "自然な肝臓のデトックスと保護。",
            "ko": "천연 간 해독 및 보호.",
        },
        price=19.99, category="digestive-health", icon="🌿",
        badges=["Optional"], sort_order=9,
    ),
    dict(
        id="smart-blood-pressure-monitor", name="Smart Blood Pressure Monitor",
        description="Bluetooth-connected monitor with companion smartphone app.",
        name_i18n={
            "en": "Smart Blood Pressure Monitor", "zh": "智能血压计",
            "ja": "スマート血圧計", "ko": "스마트 혈압계",
        },
        description_i18n={
            "en": "Bluetooth-connected monitor with companion smartphone app.",
            "zh": "蓝牙连接，配套智能手机应用。",
            "ja": "専用アプリと連携するBluetooth対応モニター。",
            "ko": "전용 앱과 연동되는 블루투스 혈압계.",
        },
        price=59.99, category="heart-health", icon="〽",
        badges=["New", "Optional"], sort_order=10,
    ),
    dict(
        id="continuous-glucose-tracker", name="Continuous Glucose Tracker",
        description="Real-time glucose monitoring for metabolic awareness.",
        name_i18n={
            "en": "Continuous Glucose Tracker", "zh": "连续血糖监测仪",
            "ja": "持続血糖トラッカー", "ko": "연속 혈당 측정기",
        },
        description_i18n={
            "en": "Real-time glucose monitoring for metabolic awareness.",
            "zh": "实时血糖监测，助力代谢健康管理。",
            "ja": "代謝の状態を把握するリアルタイム血糖モニタリング。",
            "ko": "대사 건강을 위한 실시간 혈당 모니터링.",
        },
        price=89.99, category="weight-management", icon="〽",
        badges=["Popular", "Optional"], sort_order=11,
    ),
    dict(
        id="sleep-quality-sensor", name="Sleep Quality Sensor",
        description="Advanced sleep stage tracking for better rest quality.",
        name_i18n={
            "en": "Sleep Quality Sensor", "zh": "睡眠质量监测仪",
            "ja": "睡眠クオリティセンサー", "ko": "수면 품질 센서",
        },
        description_i18n={
            "en": "Advanced sleep stage tracking for better rest quality.",
            "zh": "先进睡眠阶段追踪，改善休息质量。",
            "ja": "より良い休息のための高度な睡眠段階トラッキング。",
            "ko": "더 나은 휴식을 위한 고급 수면 단계 추적.",
        },
        price=49.99, category="sleep", icon="〽",
        badges=["Optional"], sort_order=12,
    ),
    dict(
        id="body-composition-scale", name="Body Composition Scale",
        description="Measure body fat, muscle mass, and hydration levels.",
        name_i18n={
            "en": "Body Composition Scale", "zh": "体脂体成分秤",
            "ja": "体組成計", "ko": "체성분 체중계",
        },
        description_i18n={
            "en": "Measure body fat, muscle mass, and hydration levels.",
            "zh": "测量体脂、肌肉量和水合水平。",
            "ja": "体脂肪、筋肉量、水分量を測定。",
            "ko": "체지방, 근육량, 수분 수치를 측정합니다.",
        },
        price=44.99, category="weight-management", icon="〽",
        badges=["Optional"], sort_order=13,
    ),
    dict(
        id="high-protein-chicken-bowl", name="High-Protein Chicken Bowl",
        description="Lean protein with quinoa and roasted vegetables.",
        name_i18n={
            "en": "High-Protein Chicken Bowl", "zh": "高蛋白鸡肉碗餐",
            "ja": "高タンパクチキンボウル", "ko": "고단백 치킨 볼",
        },
        description_i18n={
            "en": "Lean protein with quinoa and roasted vegetables.",
            "zh": "精瘦蛋白配藜麦和烤蔬菜。",
            "ja": "キヌアとローストした野菜を添えた赤身タンパク質。",
            "ko": "퀴노아와 로스트 채소를 곁들인 저지방 단백질.",
        },
        price=14.99, category="healthy-foods", icon="🍽",
        badges=["Chef's Pick", "Optional"], sort_order=14,
    ),
    dict(
        id="keto-meal-plan-weekly", name="Keto Meal Plan (Weekly)",
        description="7-day ketogenic meal plan for metabolic health.",
        name_i18n={
            "en": "Keto Meal Plan (Weekly)", "zh": "生酮饮食周计划",
            "ja": "ケトミールプラン（週間）", "ko": "키토 식단 플랜 (주간)",
        },
        description_i18n={
            "en": "7-day ketogenic meal plan for metabolic health.",
            "zh": "为期7天的生酮饮食计划，助力代谢健康。",
            "ja": "代謝の健康のための7日間ケトジェニックミールプラン。",
            "ko": "대사 건강을 위한 7일 케토제닉 식단 플랜.",
        },
        price=79.99, category="healthy-foods", icon="🍽",
        badges=["Optional"], sort_order=15,
    ),
    dict(
        id="organic-vegetable-box", name="Organic Vegetable Box",
        description="Fresh seasonal organic vegetables delivered weekly.",
        name_i18n={
            "en": "Organic Vegetable Box", "zh": "有机蔬菜箱",
            "ja": "オーガニック野菜ボックス", "ko": "유기농 채소 박스",
        },
        description_i18n={
            "en": "Fresh seasonal organic vegetables delivered weekly.",
            "zh": "每周配送新鲜时令有机蔬菜。",
            "ja": "毎週届く新鮮な旬のオーガニック野菜。",
            "ko": "매주 배송되는 신선한 제철 유기농 채소.",
        },
        price=34.99, category="healthy-foods", icon="🍽",
        badges=["Optional"], sort_order=16,
    ),
    dict(
        id="low-sugar-dessert-pack", name="Low-Sugar Dessert Pack",
        description="Healthy treats sweetened with natural alternatives.",
        name_i18n={
            "en": "Low-Sugar Dessert Pack", "zh": "低糖甜点礼包",
            "ja": "低糖デザートパック", "ko": "저당 디저트 팩",
        },
        description_i18n={
            "en": "Healthy treats sweetened with natural alternatives.",
            "zh": "使用天然代糖制作的健康甜点。",
            "ja": "天然甘味料を使ったヘルシーなお菓子。",
            "ko": "천연 대체 감미료로 만든 건강한 간식.",
        },
        price=18.99, category="healthy-foods", icon="🍽",
        badges=["Optional"], sort_order=17,
    ),
    dict(
        id="aromatherapy-diffuser-kit", name="Aromatherapy Diffuser Kit",
        description="Ultrasonic diffuser with 6 essential oil starter blends.",
        name_i18n={
            "en": "Aromatherapy Diffuser Kit", "zh": "香薰扩香仪套装",
            "ja": "アロマディフューザーキット", "ko": "아로마 디퓨저 키트",
        },
        description_i18n={
            "en": "Ultrasonic diffuser with 6 essential oil starter blends.",
            "zh": "超声波扩香仪，附赠6款入门精油。",
            "ja": "6種類のスターターオイル付き超音波ディフューザー。",
            "ko": "6종 스타터 오일이 포함된 초음파 디퓨저.",
        },
        price=36.99, category="sleep", icon="♡",
        badges=["Top Rated", "Optional"], sort_order=18,
    ),
    dict(
        id="sleep-sound-machine", name="Sleep Sound Machine",
        description="White noise and nature sounds for deeper, longer sleep.",
        name_i18n={
            "en": "Sleep Sound Machine", "zh": "睡眠白噪音机",
            "ja": "スリープサウンドマシン", "ko": "수면 사운드 머신",
        },
        description_i18n={
            "en": "White noise and nature sounds for deeper, longer sleep.",
            "zh": "白噪音与自然音效，助你更深更久地入睡。",
            "ja": "より深く長い眠りのためのホワイトノイズと自然音。",
            "ko": "더 깊고 긴 수면을 위한 백색소음과 자연의 소리.",
        },
        price=42.99, category="sleep", icon="♡",
        badges=["Optional"], sort_order=19,
    ),
    dict(
        id="guided-meditation-app-1yr", name="Guided Meditation App (1yr)",
        description="Structured mindfulness and breathing programs.",
        name_i18n={
            "en": "Guided Meditation App (1yr)", "zh": "引导冥想应用（1年）",
            "ja": "ガイド付き瞑想アプリ（1年）", "ko": "가이드 명상 앱 (1년)",
        },
        description_i18n={
            "en": "Structured mindfulness and breathing programs.",
            "zh": "结构化的正念与呼吸训练课程。",
            "ja": "体系化されたマインドフルネスと呼吸法プログラム。",
            "ko": "체계적인 마음챙김 및 호흡 프로그램.",
        },
        price=49.99, category="brain-health", icon="♡",
        badges=["Popular", "Optional"], sort_order=20,
    ),
    dict(
        id="stress-relief-journal-set", name="Stress Relief Journal Set",
        description="Guided journaling prompts for mental clarity and calm.",
        name_i18n={
            "en": "Stress Relief Journal Set", "zh": "减压日记套装",
            "ja": "ストレス解消ジャーナルセット", "ko": "스트레스 완화 저널 세트",
        },
        description_i18n={
            "en": "Guided journaling prompts for mental clarity and calm.",
            "zh": "引导式书写提示，帮助理清思路、平静心情。",
            "ja": "心の整理と落ち着きのためのガイド付きジャーナリングプロンプト。",
            "ko": "명료함과 안정을 위한 가이드 저널링 프롬프트.",
        },
        price=16.99, category="sleep", icon="♡",
        badges=["Optional"], sort_order=21,
    ),
]


def _stripe_price_env_name(product_id: str) -> str:
    return "STRIPE_PRICE_" + product_id.upper().replace("-", "_")

def _apply_stripe_price_ids() -> None:
    for product in DEFAULT_PRODUCTS:
        product["stripe_price_id"] = os.getenv(_stripe_price_env_name(product["id"]), product.get("stripe_price_id"))


_apply_stripe_price_ids()


def seed_products(db: Session) -> None:
    """Insert any default-catalog product that isn't already in the
    database yet, matched by id. Safe to call on every startup: existing
    products (including ones edited via the admin dashboard) are left
    untouched, and this naturally picks up new items added to
    DEFAULT_PRODUCTS later without needing a manual migration step.

    Also non-destructively enriches products that already exist (e.g.
    from before name_i18n existed) with any language keys they're
    currently missing -- merging in, never overwriting a key that's
    already set, so an admin's manual edits are always preserved."""
    existing = {p.id: p for p in db.query(Product).all()}

    changed = False
    for data in DEFAULT_PRODUCTS:
        product = existing.get(data["id"])

        if product is None:
            db.add(Product(**data))
            changed = True
            continue

        name_i18n = dict(product.name_i18n or {})
        description_i18n = dict(product.description_i18n or {})

        for lang, value in data["name_i18n"].items():
            if lang not in name_i18n:
                name_i18n[lang] = value
                changed = True

        for lang, value in data["description_i18n"].items():
            if lang not in description_i18n:
                description_i18n[lang] = value
                changed = True

        if name_i18n != (product.name_i18n or {}):
            product.name_i18n = name_i18n
        if description_i18n != (product.description_i18n or {}):
            product.description_i18n = description_i18n

        env_price_id = data.get("stripe_price_id")
        if env_price_id and not product.stripe_price_id:
            product.stripe_price_id = env_price_id
            changed = True

    if changed:
        db.commit()


DEFAULT_CATEGORIES = [
    dict(id="heart-health", name="Heart Health", icon="❤", sort_order=1),
    dict(id="brain-health", name="Brain Health", icon="🧠", sort_order=2),
    dict(id="digestive-health", name="Digestive Health", icon="🍃", sort_order=3),
    dict(id="immune-health", name="Immune Health", icon="🛡", sort_order=4),
    dict(id="sleep", name="Sleep", icon="🌙", sort_order=5),
    dict(id="energy", name="Energy", icon="⚡", sort_order=6),
    dict(id="bone-joint", name="Bone & Joint", icon="🦴", sort_order=7),
    dict(id="weight-management", name="Weight Management", icon="⚖", sort_order=8),
    dict(id="healthy-foods", name="Healthy foods", icon="🥗", sort_order=9),
]

# One-time re-categorization: the marketplace used to be organized by
# product type (Supplements/Herbs/Devices/Meals/Wellness). Moving to
# "Health Goals" instead -- this maps each known seeded product to its
# new category.
PRODUCT_RECATEGORIZATION = {
    "omega-3-fish-oil": "heart-health",
    "vitamin-d3-5000iu": "immune-health",
    "zinc-selenium-complex": "immune-health",
    "vegan-protein-blend": "weight-management",
    "magnesium-glycinate-400mg": "sleep",
    "organic-ashwagandha": "energy",
    "ginseng-root-extract": "energy",
    "turmeric-curcumin-95": "bone-joint",
    "milk-thistle-liver-support": "digestive-health",
    "smart-blood-pressure-monitor": "heart-health",
    "continuous-glucose-tracker": "weight-management",
    "sleep-quality-sensor": "sleep",
    "body-composition-scale": "weight-management",
    "high-protein-chicken-bowl": "healthy-foods",
    "keto-meal-plan-weekly": "healthy-foods",
    "organic-vegetable-box": "healthy-foods",
    "low-sugar-dessert-pack": "healthy-foods",
    "aromatherapy-diffuser-kit": "sleep",
    "sleep-sound-machine": "sleep",
    "guided-meditation-app-1yr": "brain-health",
    "stress-relief-journal-set": "sleep",
}

OLD_CATEGORY_IDS = ["supplements", "herbs", "devices", "meals", "wellness"]


def seed_categories(db: Session) -> None:
    """Same idempotent pattern as seed_products: insert any default
    category that isn't already in the database yet. Once seeded,
    categories are managed via the /admin/categories API (and the
    admin.html dashboard) — this never overwrites existing rows."""
    existing_ids = {c.id for c in db.query(Category.id).all()}

    added = False
    for data in DEFAULT_CATEGORIES:
        if data["id"] in existing_ids:
            continue
        db.add(Category(**data))
        added = True

    if added:
        db.commit()


def reorganize_into_health_goals(db: Session) -> None:
    """One-time move from the old product-type categories to the new
    Health Goals structure. Safe to call on every startup: only acts
    if any of the old category ids still exist, and only reassigns
    products that are still sitting on one of the old categories (so
    it won't clobber a category an admin has since changed by hand)."""
    old_categories_present = (
        db.query(Category).filter(Category.id.in_(OLD_CATEGORY_IDS)).count()
    )
    if not old_categories_present:
        return  # already migrated

    products = db.query(Product).filter(Product.category.in_(OLD_CATEGORY_IDS)).all()
    for product in products:
        new_category = PRODUCT_RECATEGORIZATION.get(product.id)
        if new_category:
            product.category = new_category
    db.commit()

    # Now safe to remove the old categories, since nothing references
    # them anymore (any product not in PRODUCT_RECATEGORIZATION -- e.g.
    # one an admin added by hand under an old category -- is left on
    # that old category rather than silently reassigned; the category
    # row itself is only deleted once zero products use it).
    for old_id in OLD_CATEGORY_IDS:
        still_used = db.query(Product).filter(Product.category == old_id).count()
        if still_used == 0:
            db.query(Category).filter(Category.id == old_id).delete()
    db.commit()
