"""
Goal Planning Agent

Responsibilities (FR-7.1–7.4):
  - Read active goals from the Twin
  - Compute progress rates and forecast completion dates
  - Generate goal-connected recommendations
  - Every recommendation MUST connect to a specific goal (architecture principle)
"""

import time
import json
import structlog
from datetime import date, timedelta
from typing import Optional

from anthropic import AsyncAnthropic
from neo4j import AsyncSession

from app.config import get_settings
from app.db.queries import run_write, WRITE_RECOMMENDATION, LOG_AGENT_CALL
from app.models.schemas import AgentState, RecommendationObject, Priority
import hashlib
from uuid import uuid4

log = structlog.get_logger(__name__)
AGENT_NAME = "GoalPlanningAgent"

GOAL_LABELS = {
    "EMERGENCY_FUND": "Emergency Fund",
    "VACATION": "Vacation Fund",
    "COLLEGE": "College Fund",
    "DEBT_PAYOFF": "Debt Payoff",
}


def _months_to_completion(current: float, target: float, monthly: float) -> Optional[float]:
    if target <= 0 or monthly <= 0:
        return None
    remaining = target - current
    if remaining <= 0:
        return 0
    return remaining / monthly


def _forecast_date(months: float) -> str:
    d = date.today() + timedelta(days=int(months * 30.44))
    return d.strftime("%b %Y")


async def _generate_goal_recommendation(
    goal: dict,
    snapshot: dict,
    client: AsyncAnthropic,
) -> tuple[str, str, str]:
    settings = get_settings()

    goal_type = goal.get("goal_type", "")
    label = GOAL_LABELS.get(goal_type, goal_type)
    target = goal.get("target", 0)
    current = goal.get("current", 0)
    monthly = goal.get("monthly", 0)
    progress_pct = int((current / target * 100) if target > 0 else 0)
    months_left = _months_to_completion(current, target, monthly)
    forecast = _forecast_date(months_left) if months_left else "unknown"

    prompt = f"""You are a financial goal coach. Generate a specific recommendation for this goal.

GOAL: {label}
Progress: ${current:,.0f} of ${target:,.0f} ({progress_pct}%)
Monthly contribution: ${monthly:,.0f}
Projected completion: {forecast}
Customer context: {snapshot.get('context_labels', [])}

RULES: No investment advice, no guarantees, educational only.

Respond in JSON:
{{
  "reason": "why this recommendation (one sentence, reference the goal progress)",
  "recommendation_text": "specific action (max 12 words, include dollar amount if possible)",
  "expected_impact": "outcome tied to this goal's timeline (max 15 words)"
}}

JSON only."""

    response = await client.messages.create(
        model=settings.claude_model,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    try:
        parsed = json.loads(text)
        return (
            parsed.get("reason", f"{label} is below target"),
            parsed.get("recommendation_text", f"Increase {label} contributions"),
            parsed.get("expected_impact", f"Reach {label} target sooner"),
        )
    except Exception:
        return (
            f"{label} is {progress_pct}% complete",
            f"Increase monthly {label} contribution",
            f"Reach {label} goal by {forecast}",
        )


async def run_goal_planning_agent(
    state: AgentState,
    session: AsyncSession,
    anthropic_client: AsyncAnthropic,
) -> AgentState:
    log.info("goal_agent.start", hid=state.customer_hid[:8])
    start = time.time()
    settings = get_settings()

    try:
        goals = (state.snapshot or {}).get("goals") or []
        if not goals:
            log.info("goal_agent.no_goals")
            # Emit a recommendation to CREATE an emergency fund if none exists
            rec = RecommendationObject(
                agent=AGENT_NAME,
                priority=Priority.HIGH,
                reason="No financial goals are set. Emergency Fund is the highest-priority first goal.",
                recommendation_text="Create an Emergency Fund goal to start building resilience",
                expected_impact="Establish financial safety net and improve goal readiness score",
                confidence=0.92,
                requires_approval=True,
                session_id=state.session_id,
            )
            state.goal_recommendations.append(rec)
            return state

        # Generate a recommendation for the most behind goal
        goals_with_gap = []
        for g in goals:
            target = g.get("target", 0)
            current = g.get("current", 0)
            monthly = g.get("monthly", 0)
            if target > 0:
                gap_pct = 1 - (current / target)
                goals_with_gap.append((gap_pct, g))

        goals_with_gap.sort(key=lambda x: x[0], reverse=True)

        for _, goal in goals_with_gap[:2]:  # top 2 most-behind goals
            reason, rec_text, impact = await _generate_goal_recommendation(
                goal, state.snapshot, anthropic_client
            )

            target = goal.get("target", 0)
            current = goal.get("current", 0)
            progress_pct = (current / target * 100) if target > 0 else 0
            confidence = 0.88 if progress_pct < 50 else 0.75
            priority = Priority.HIGH if progress_pct < 25 else Priority.MEDIUM

            if confidence >= settings.confidence_present_caution:
                rec = RecommendationObject(
                    recommendation_id=str(uuid4()),
                    agent=AGENT_NAME,
                    priority=priority,
                    reason=reason,
                    recommendation_text=rec_text,
                    expected_impact=impact,
                    confidence=confidence,
                    requires_approval=True,
                    goal_id=goal.get("goal_id"),
                    session_id=state.session_id,
                )
                state.goal_recommendations.append(rec)

                # Write to Neo4j
                await run_write(
                    session, WRITE_RECOMMENDATION,
                    hid=state.customer_hid,
                    recommendation_id=rec.recommendation_id,
                    agent=AGENT_NAME,
                    priority=rec.priority,
                    reason=rec.reason,
                    recommendation_text=rec.recommendation_text,
                    expected_impact=rec.expected_impact,
                    confidence=rec.confidence,
                    requires_approval=rec.requires_approval,
                    goal_id=rec.goal_id,
                    session_id=state.session_id,
                    pg_recommendation_id=rec.recommendation_id,
                )

        latency_ms = int((time.time() - start) * 1000)
        log.info("goal_agent.done", recs=len(state.goal_recommendations), latency_ms=latency_ms)

    except Exception as e:
        log.exception("goal_agent.error", error=str(e))
        state.errors.append(f"GoalPlanningAgent: {str(e)}")

    return state
