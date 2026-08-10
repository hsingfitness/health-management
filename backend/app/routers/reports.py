from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user_optional
from ..models import Report, User
from ..schemas import ReportOut, ReportRequest

router = APIRouter(prefix="/reports", tags=["reports"])

DISCLAIMER = (
    "This is a general wellness summary, not a medical diagnosis. "
    "Please consult a qualified healthcare provider for any health concerns."
)

URGENT_TERMS = (
    "chest pain",
    "shortness of breath",
    "trouble breathing",
    "difficulty breathing",
    "faint",
    "fainted",
    "severe pain",
    "stroke",
    "suicidal",
    "blood",
)

MODERATE_TERMS = (
    "fever",
    "dizzy",
    "dizziness",
    "vomit",
    "vomiting",
    "diarrhea",
    "migraine",
    "persistent",
    "worse",
    "worsening",
    "pain",
)


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    normalized = text.lower()
    return any(term in normalized for term in terms)


def _risk_level(symptom_details: str) -> str:
    if _contains_any(symptom_details, URGENT_TERMS):
        return "See a doctor soon"
    if _contains_any(symptom_details, MODERATE_TERMS):
        return "Moderate"
    return "Low"


def _missing_meals(payload: ReportRequest) -> list[str]:
    return [
        label
        for label, value in (
            ("breakfast", payload.breakfast),
            ("lunch", payload.lunch),
            ("dinner", payload.dinner),
        )
        if not value.strip()
    ]


def _build_summary(payload: ReportRequest, risk_level: str, tier: str) -> str:
    meal_note = ""
    missing = _missing_meals(payload)
    if missing:
        meal_note = f" Your log is missing {', '.join(missing)}, so nutrition suggestions are limited."

    sleep_note = ""
    if payload.sleep.strip():
        sleep_note = " Your sleep note is included as a lifestyle factor to review."
    else:
        sleep_note = " Adding sleep duration and sleep quality next time will make the review more useful."

    if tier == "customized":
        return (
            f"Based on the symptoms you described, this rule-based wellness review rates the current concern as {risk_level.lower()}. "
            "It looks at your symptom note together with your meal and sleep entries, without using an AI model or outside service."
            f"{meal_note}{sleep_note} Track whether symptoms improve, stay the same, or get worse over the next day."
        )

    return (
        f"Based on the symptoms you described, this rule-based wellness review rates the current concern as {risk_level.lower()}. "
        "It uses only the information you entered and does not call an AI model or external report service."
        f"{meal_note}{sleep_note}"
    )


def _build_recommendations(payload: ReportRequest, risk_level: str, tier: str) -> list[str]:
    recommendations = [
        "Stay hydrated and choose balanced meals with protein, fiber-rich carbohydrates, and colorful fruits or vegetables.",
        "Prioritize rest and keep a simple log of symptoms, meals, sleep, and any triggers you notice.",
        "Seek professional medical advice if symptoms are concerning, severe, unusual, or not improving.",
    ]

    if _missing_meals(payload):
        recommendations.append("Fill in all meals next time so the wellness review can better reflect your day.")
    if not payload.sleep.strip():
        recommendations.append("Record sleep duration and sleep quality, since poor sleep can affect energy, appetite, and recovery.")
    if risk_level == "See a doctor soon":
        recommendations.insert(0, "Because your symptoms include potential red flags, consider contacting a healthcare professional promptly.")
    elif risk_level == "Moderate":
        recommendations.append("If symptoms persist, worsen, or interfere with normal activities, arrange a medical check-in.")

    if tier == "customized":
        recommendations.extend(
            [
                "Review whether symptoms appeared after any specific meal, caffeine intake, stress, exercise, or missed sleep.",
                "Plan a consistent wake time and a calming pre-sleep routine for the next few nights.",
            ]
        )

    return recommendations[:8]


@router.post("/generate", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def generate_report(
    payload: ReportRequest,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    # Tier is decided server-side from the authenticated user's paid plan —
    # never trust a client-supplied flag for this.
    tier = "customized" if (current_user and current_user.plan in ("member", "vip")) else "free"
    risk_level = _risk_level(payload.symptom_details)
    output = {
        "summary": _build_summary(payload, risk_level, tier),
        "risk_level": risk_level,
        "recommendations": _build_recommendations(payload, risk_level, tier),
        "disclaimer": DISCLAIMER,
        "tier": tier,
    }

    report = Report(
        user_id=str(current_user.id) if current_user else None,
        input=payload.model_dump(),
        output=output,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return ReportOut(id=str(report.id), created_at=report.created_at, **output)


@router.get("", response_model=list[ReportOut])
def list_my_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user_optional),
):
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    reports = (
        db.query(Report)
        .filter(Report.user_id == str(current_user.id))
        .order_by(Report.created_at.desc())
        .all()
    )
    return [
        ReportOut(
            id=str(r.id),
            created_at=r.created_at,
            **r.output,
        )
        for r in reports
    ]
