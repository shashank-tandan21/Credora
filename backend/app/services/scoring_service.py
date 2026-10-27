from dataclasses import dataclass


WEIGHTS: dict[str, float] = {
    "Repayment history": 0.35,
    "Affordability": 0.25,
    "Cash-flow stability": 0.15,
    "Debt burden": 0.15,
    "Evidence quality": 0.10,
}


@dataclass(frozen=True)
class ScoreInputs:
    repayment_history: float
    affordability: float
    cash_flow_stability: float
    debt_burden: float
    evidence_quality: float


@dataclass(frozen=True)
class ScoreResult:
    score: float
    risk_category: str
    contributions: dict[str, tuple[float, float]]
    explanation: list[str]


def calculate_score(inputs: ScoreInputs) -> ScoreResult:
    values = {
        "Repayment history": inputs.repayment_history,
        "Affordability": inputs.affordability,
        "Cash-flow stability": inputs.cash_flow_stability,
        "Debt burden": inputs.debt_burden,
        "Evidence quality": inputs.evidence_quality,
    }
    contributions = {
        name: (value, round(value * WEIGHTS[name], 2))
        for name, value in values.items()
    }
    score = round(sum(contribution for _, contribution in contributions.values()), 2)

    if score < 40:
        category = "High risk"
    elif score < 60:
        category = "Moderate risk"
    elif score < 75:
        category = "Fair"
    elif score < 90:
        category = "Good"
    else:
        category = "Strong"

    strongest = max(values, key=values.get)
    weakest = min(values, key=values.get)
    explanation = [
        f"{strongest} is the strongest positive factor at {values[strongest]:.1f}/100.",
        f"{weakest} is the main factor limiting the score at {values[weakest]:.1f}/100.",
        "This is an academic prototype score and not a validated lending risk model.",
    ]
    return ScoreResult(score, category, contributions, explanation)
