"""
Supervisor Agent

Responsibilities (FR-8.5, FR-9.1–9.3):
  - Collect Recommendation Objects from all specialist agents
  - Resolve conflicts via priority policy (Survival > Stability > Growth)
  - Apply confidence suppression thresholds (AI governance)
  - Rank to a single Next Best Action
  - Write Recommendation nodes to Neo4j with full lineage
  - Emit the final AnalyzeResponse to Spring Boot
"""

import structlog
from neo4j import AsyncSession

from app.config import get_settings
from app.db.queries import run_write, WRITE_RECOMMENDATION
from app.models.schemas import (
    AgentState, RecommendationObject, Priority,
    AnalyzeResponse, RecommendationResponse, ResilienceScoreResponse,
    DetectedEventResponse,
)

log = structlog.get_logger(__name__)
AGENT_NAME = "SupervisorAgent"

# Priority conflict resolution — frozen architecture Section 13
# Level 1: Financial Survival (CRITICAL) overrides everything
# Level 2: Financial Stability (HIGH) overrides MEDIUM/LOW
# Level 3: Financial Growth (MEDIUM/LOW)
PRIORITY_RANK = {
    Priority.CRITICAL: 0,
    Priority.HIGH: 1,
    Priority.MEDIUM: 2,
    Priority.LOW: 3,
    "CRITICAL": 0,
    "HIGH": 1,
    "MEDIUM": 2,
    "LOW": 3,
}


def _collect_all_recommendations(state: AgentState) -> list[RecommendationObject]:
    """Gather all recommendations from specialist agents."""
    all_recs: list[RecommendationObject] = []

    if state.assessment_recommendation:
        all_recs.append(state.assessment_recommendation)

    all_recs.extend(state.goal_recommendations)
    all_recs.extend(state.event_intelligence_recs)

    return all_recs


def _apply_confidence_policy(recs: list[RecommendationObject]) -> list[RecommendationObject]:
    """
    AI governance — frozen architecture Section 16:
    - confidence >= 0.90: present normally
    - confidence 0.70–0.89: present with caution label (handled in UI)
    - confidence < 0.70: suppress entirely
    """
    settings = get_settings()
    return [r for r in recs if r.confidence >= settings.confidence_present_caution]


def _deduplicate(recs: list[RecommendationObject]) -> list[RecommendationObject]:
    """
    Remove near-duplicate recommendations (same priority + overlapping reason).
    Keep the one with highest confidence.
    """
    seen_priorities: dict[str, RecommendationObject] = {}
    for rec in sorted(recs, key=lambda r: r.confidence, reverse=True):
        priority_key = str(rec.priority)
        if priority_key not in seen_priorities:
            seen_priorities[priority_key] = rec
    return list(seen_priorities.values())


def _rank_recommendations(recs: list[RecommendationObject]) -> list[RecommendationObject]:
    """
    Sort by priority rank then by confidence descending.
    CRITICAL and HIGH always surface before MEDIUM and LOW.
    """
    return sorted(
        recs,
        key=lambda r: (PRIORITY_RANK.get(str(r.priority), 4), -r.confidence),
    )


async def run_supervisor_agent(
    state: AgentState,
    session: AsyncSession,
) -> AgentState:
    log.info("supervisor.start", hid=state.customer_hid[:8])
    settings = get_settings()

    try:
        all_recs = _collect_all_recommendations(state)
        log.info("supervisor.collected", count=len(all_recs))

        # Apply governance filters
        filtered = _apply_confidence_policy(all_recs)
        deduplicated = _deduplicate(filtered)
        ranked = _rank_recommendations(deduplicated)

        # Cap at 3 recommendations per session
        final_recs = ranked[:3]
        state.ranked_recommendations = final_recs

        # Next Best Action = top recommendation
        if final_recs:
            state.next_best_action = final_recs[0]

        # Write all recommendations to Neo4j with lineage
        for rec in final_recs:
            try:
                await run_write(
                    session, WRITE_RECOMMENDATION,
                    hid=state.customer_hid,
                    recommendation_id=rec.recommendation_id,
                    agent=rec.agent,
                    priority=str(rec.priority),
                    reason=rec.reason,
                    recommendation_text=rec.recommendation_text,
                    expected_impact=rec.expected_impact,
                    confidence=rec.confidence,
                    requires_approval=rec.requires_approval,
                    goal_id=rec.goal_id,
                    session_id=rec.session_id,
                    pg_recommendation_id=rec.recommendation_id,
                )
            except Exception as we:
                log.warning("supervisor.write_rec_failed", rec_id=rec.recommendation_id, error=str(we))

        log.info("supervisor.done",
                 ranked=len(final_recs),
                 nba=state.next_best_action.priority if state.next_best_action else None)

    except Exception as e:
        log.exception("supervisor.error", error=str(e))
        state.errors.append(f"SupervisorAgent: {str(e)}")

    return state


def build_analyze_response(state: AgentState) -> AnalyzeResponse:
    """Serialise the final state into the Spring Boot API contract."""

    def _rec_to_response(r: RecommendationObject) -> RecommendationResponse:
        return RecommendationResponse(
            recommendation_id=r.recommendation_id,
            agent=r.agent,
            priority=str(r.priority),
            reason=r.reason,
            recommendation_text=r.recommendation_text,
            expected_impact=r.expected_impact,
            confidence=r.confidence,
            requires_approval=r.requires_approval,
            goal_id=r.goal_id,
            session_id=r.session_id,
        )

    score_response = None
    if state.resilience_score:
        score_response = ResilienceScoreResponse(
            overall=state.resilience_score.overall,
            components={
                "emergencyFund": state.resilience_score.components.emergency_fund,
                "cashFlow": state.resilience_score.components.cash_flow,
                "debtBurden": state.resilience_score.components.debt_burden,
                "incomeStability": state.resilience_score.components.income_stability,
                "goalReadiness": state.resilience_score.components.goal_readiness,
            },
        )

    event_responses = [
        DetectedEventResponse(
            event_id=e.event_id,
            event_type=e.event_type,
            label=e.label,
            total_cost=e.total_cost,
            transaction_count=e.transaction_count,
            confidence=e.confidence,
            confirmed=e.confirmed,
            date_range_start=e.date_range_start,
            date_range_end=e.date_range_end,
        )
        for e in state.detected_events
    ]

    return AnalyzeResponse(
        session_id=state.session_id,
        customer_hashed_id=state.customer_hid,
        resilience_score=score_response,
        recommendations=[_rec_to_response(r) for r in state.ranked_recommendations],
        next_best_action=_rec_to_response(state.next_best_action) if state.next_best_action else None,
        detected_events=event_responses,
        errors=state.errors,
        stale=False,
    )
