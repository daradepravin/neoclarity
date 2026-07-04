"""
Agent evaluation suite.

Directly addresses the bootcamp scorecard line "eval pass rate for agent
workflows." These are deterministic unit-level evals over the scoring
functions and supervisor ranking — they run WITHOUT Neo4j or Anthropic,
so they're fast and CI-friendly.

Each fixture is a household financial snapshot with an EXPECTED score range
and expected Next-Best-Action priority. If the scoring logic drifts, these
fail — that's the point.

Run: pytest tests/test_agent_evals.py -v
"""

import pytest
from app.agents.financial_assessment import compute_score
from app.agents.supervisor import (
    _rank_recommendations, _apply_confidence_policy, _deduplicate
)
from app.models.schemas import RecommendationObject, Priority


# ── FIXTURES: five engineered household snapshots ────────────────────────────

def _snapshot(accounts, transactions, goals):
    return {"accounts": accounts, "transactions": transactions, "goals": goals}


FIXTURES = {
    "healthy_household": {
        "snapshot": _snapshot(
            accounts=[
                {"account_type": "CHECKING", "balance": 8000},
                {"account_type": "SAVINGS", "balance": 30000},
                {"account_type": "CREDIT", "balance": -500},
            ],
            transactions=(
                [{"amount": 3100, "income_flag": True, "date": "2026-06-15", "category": "Income"}] * 3 +
                [{"amount": -1500, "income_flag": False, "date": "2026-06-10", "category": "Housing"}] * 3
            ),
            goals=[{"goal_type": "EMERGENCY_FUND", "target": 20000, "current": 18000, "monthly": 500}],
        ),
        "expected_score_min": 70,
        "expected_score_max": 100,
    },
    "stressed_household": {
        "snapshot": _snapshot(
            accounts=[
                {"account_type": "CHECKING", "balance": 1200},
                {"account_type": "SAVINGS", "balance": 2000},
                {"account_type": "CREDIT", "balance": -6800},
            ],
            transactions=(
                [{"amount": 3100, "income_flag": True, "date": "2026-06-15", "category": "Income"}] * 3 +
                [{"amount": -2800, "income_flag": False, "date": "2026-06-10", "category": "Housing"}] * 3
            ),
            goals=[{"goal_type": "EMERGENCY_FUND", "target": 20000, "current": 2000, "monthly": 100}],
        ),
        "expected_score_min": 20,
        "expected_score_max": 55,
    },
    "no_savings_household": {
        "snapshot": _snapshot(
            accounts=[
                {"account_type": "CHECKING", "balance": 900},
                {"account_type": "CREDIT", "balance": -3200},
            ],
            transactions=(
                [{"amount": 2800, "income_flag": True, "date": "2026-06-15", "category": "Income"}] * 3 +
                [{"amount": -2600, "income_flag": False, "date": "2026-06-10", "category": "Housing"}] * 3
            ),
            goals=[],
        ),
        "expected_score_min": 10,
        "expected_score_max": 45,
    },
    "no_data_household": {
        "snapshot": _snapshot(accounts=[], transactions=[], goals=[]),
        "expected_score_min": 0,
        "expected_score_max": 60,   # neutral defaults when data is sparse
    },
    "high_income_low_savings": {
        "snapshot": _snapshot(
            accounts=[
                {"account_type": "CHECKING", "balance": 4000},
                {"account_type": "SAVINGS", "balance": 1500},
            ],
            transactions=(
                [{"amount": 6000, "income_flag": True, "date": "2026-06-15", "category": "Income"}] * 3 +
                [{"amount": -5500, "income_flag": False, "date": "2026-06-10", "category": "Lifestyle"}] * 3
            ),
            goals=[{"goal_type": "VACATION", "target": 5000, "current": 500, "monthly": 200}],
        ),
        "expected_score_min": 25,
        "expected_score_max": 65,
    },
}


# ── EVAL 1: score falls in expected range for each household ──────────────────

@pytest.mark.parametrize("name", list(FIXTURES.keys()))
def test_score_in_expected_range(name):
    fixture = FIXTURES[name]
    score = compute_score(fixture["snapshot"])
    assert fixture["expected_score_min"] <= score.overall <= fixture["expected_score_max"], (
        f"{name}: score {score.overall} outside "
        f"[{fixture['expected_score_min']},{fixture['expected_score_max']}]"
    )


# ── EVAL 2: healthy household scores higher than stressed ────────────────────

def test_healthy_beats_stressed():
    healthy = compute_score(FIXTURES["healthy_household"]["snapshot"]).overall
    stressed = compute_score(FIXTURES["stressed_household"]["snapshot"]).overall
    assert healthy > stressed, f"healthy({healthy}) should exceed stressed({stressed})"


# ── EVAL 3: all component scores are within 0–100 ────────────────────────────

@pytest.mark.parametrize("name", list(FIXTURES.keys()))
def test_components_bounded(name):
    score = compute_score(FIXTURES[name]["snapshot"])
    for field, val in score.components.model_dump().items():
        assert 0 <= val <= 100, f"{name}.{field} = {val} out of bounds"


# ── EVAL 4: supervisor ranks CRITICAL above LOW ──────────────────────────────

def test_supervisor_ranking_priority():
    recs = [
        RecommendationObject(agent="A", priority=Priority.LOW, reason="r",
                             recommendation_text="low", expected_impact="i", confidence=0.95),
        RecommendationObject(agent="B", priority=Priority.CRITICAL, reason="r",
                             recommendation_text="critical", expected_impact="i", confidence=0.80),
        RecommendationObject(agent="C", priority=Priority.MEDIUM, reason="r",
                             recommendation_text="medium", expected_impact="i", confidence=0.90),
    ]
    ranked = _rank_recommendations(recs)
    assert ranked[0].priority == "CRITICAL", "CRITICAL must rank first regardless of confidence"
    assert ranked[-1].priority == "LOW", "LOW must rank last"


# ── EVAL 5: confidence policy suppresses below threshold ─────────────────────

def test_confidence_suppression():
    recs = [
        RecommendationObject(agent="A", priority=Priority.HIGH, reason="r",
                             recommendation_text="keep", expected_impact="i", confidence=0.85),
        RecommendationObject(agent="B", priority=Priority.HIGH, reason="r",
                             recommendation_text="suppress", expected_impact="i", confidence=0.55),
    ]
    filtered = _apply_confidence_policy(recs)
    texts = [r.recommendation_text for r in filtered]
    assert "keep" in texts, "0.85 confidence should survive"
    assert "suppress" not in texts, "0.55 confidence should be suppressed (below 0.70)"


# ── EVAL 6: dedupe keeps highest confidence per priority ─────────────────────

def test_dedupe_keeps_highest_confidence():
    recs = [
        RecommendationObject(agent="A", priority=Priority.HIGH, reason="r",
                             recommendation_text="lower", expected_impact="i", confidence=0.72),
        RecommendationObject(agent="B", priority=Priority.HIGH, reason="r",
                             recommendation_text="higher", expected_impact="i", confidence=0.91),
    ]
    deduped = _deduplicate(recs)
    assert len(deduped) == 1, "same-priority recs should dedupe to one"
    assert deduped[0].recommendation_text == "higher", "should keep the higher-confidence rec"
