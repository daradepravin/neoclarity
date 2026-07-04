"""
Financial Assessment Agent

Responsibilities (FR-5.1–5.5):
  - Read the customer's financial snapshot from the Neo4j Twin
  - Compute the five-component Financial Resilience Score
  - Generate one HIGH-priority coaching recommendation via Claude
  - Write the immutable ResilienceScore node to Neo4j
  - Emit a Standard Recommendation Object to the Supervisor
"""

import hashlib
import time
import structlog
from uuid import uuid4

from anthropic import AsyncAnthropic
from neo4j import AsyncSession

from app.config import get_settings
from app.db.queries import run_read, run_write, CUSTOMER_SNAPSHOT, WRITE_RESILIENCE_SCORE, LOG_AGENT_CALL
from app.models.schemas import (
    AgentState, RecommendationObject, ResilienceScore,
    ResilienceComponents, Priority
)

log = structlog.get_logger(__name__)
AGENT_NAME = "FinancialAssessmentAgent"


# ── SCORE COMPUTATION ─────────────────────────────────────────────────────────

def _compute_emergency_fund_score(transactions: list[dict], accounts: list[dict]) -> int:
    """
    Emergency fund score = (savings balance / monthly_expenses) / 6 months * 100
    Capped at 100.
    """
    savings = sum(a.get("balance") or 0 for a in accounts if a.get("account_type") in ("SAVINGS",))
    monthly_expenses = _monthly_expenses(transactions)
    if monthly_expenses <= 0:
        return 50  # insufficient data — neutral
    months_covered = savings / monthly_expenses
    return min(100, int((months_covered / 6.0) * 100))


def _compute_cash_flow_score(transactions: list[dict]) -> int:
    """
    Cash flow score: income vs expense ratio over 90 days.
    > 1.2 income/expense → 100; < 0.8 → 0; linear between.
    """
    income = sum(abs(t.get("amount") or 0) for t in transactions if t.get("income_flag"))
    expenses = sum(abs(t.get("amount") or 0) for t in transactions if not t.get("income_flag") and (t.get("amount") or 0) < 0)
    if expenses <= 0:
        return 70
    ratio = income / expenses
    if ratio >= 1.2:
        return 100
    if ratio <= 0.8:
        return 0
    return int((ratio - 0.8) / 0.4 * 100)


def _compute_debt_burden_score(accounts: list[dict], transactions: list[dict]) -> int:
    """
    Debt burden score: higher is better (lower debt).
    Simple proxy: credit balance / total assets. Lower ratio = higher score.
    """
    credit_debt = sum(abs(a.get("balance") or 0) for a in accounts
                      if a.get("account_type") == "CREDIT" and (a.get("balance") or 0) < 0)
    total_assets = sum(a.get("balance") or 0 for a in accounts if (a.get("balance") or 0) > 0)
    if total_assets <= 0:
        return 50
    debt_ratio = credit_debt / total_assets
    if debt_ratio <= 0.1:
        return 100
    if debt_ratio >= 0.5:
        return 0
    return int((1 - (debt_ratio - 0.1) / 0.4) * 100)


def _compute_income_stability_score(transactions: list[dict]) -> int:
    """
    Income stability: how consistent are income events month-to-month.
    Counts income transactions per 30-day bucket and measures variance.
    """
    from collections import defaultdict
    from datetime import date

    monthly_income: dict[str, float] = defaultdict(float)
    for t in transactions:
        if t.get("income_flag") and t.get("date"):
            try:
                d = date.fromisoformat(t["date"][:10])
                key = f"{d.year}-{d.month:02d}"
                monthly_income[key] += abs(t.get("amount") or 0)
            except Exception:
                pass

    values = list(monthly_income.values())
    if len(values) < 2:
        return 70  # insufficient history — neutral-positive
    avg = sum(values) / len(values)
    if avg == 0:
        return 50
    variance = sum((v - avg) ** 2 for v in values) / len(values)
    cv = (variance ** 0.5) / avg  # coefficient of variation
    if cv <= 0.05:
        return 100
    if cv >= 0.4:
        return 20
    return int((1 - (cv - 0.05) / 0.35) * 80 + 20)


def _compute_goal_readiness_score(goals: list[dict]) -> int:
    """
    Goal readiness: average progress across active goals.
    No goals → 30 (below average, no savings intent signalled).
    """
    if not goals:
        return 30
    progress_pcts = []
    for g in goals:
        target = g.get("target") or 0
        current = g.get("current") or 0
        if target > 0:
            progress_pcts.append(min(100, (current / target) * 100))
    if not progress_pcts:
        return 30
    return int(sum(progress_pcts) / len(progress_pcts))


def _monthly_expenses(transactions: list[dict]) -> float:
    total = sum(abs(t.get("amount") or 0) for t in transactions
                if not t.get("income_flag") and (t.get("amount") or 0) < 0)
    return total / 3.0  # 90-day window → 3 months


def compute_score(snapshot: dict) -> ResilienceScore:
    settings = get_settings()
    accounts = snapshot.get("accounts") or []
    transactions = snapshot.get("transactions") or []
    goals = snapshot.get("goals") or []

    ef = _compute_emergency_fund_score(transactions, accounts)
    cf = _compute_cash_flow_score(transactions)
    db = _compute_debt_burden_score(accounts, transactions)
    is_ = _compute_income_stability_score(transactions)
    gr = _compute_goal_readiness_score(goals)

    overall = int(
        ef * settings.weight_emergency_fund +
        cf * settings.weight_cash_flow +
        db * settings.weight_debt_burden +
        is_ * settings.weight_income_stability +
        gr * settings.weight_goal_readiness
    )

    return ResilienceScore(
        overall=min(100, max(0, overall)),
        components=ResilienceComponents(
            emergency_fund=ef,
            cash_flow=cf,
            debt_burden=db,
            income_stability=is_,
            goal_readiness=gr,
        )
    )


# ── COACHING NARRATIVE ────────────────────────────────────────────────────────

async def _generate_coaching_narrative(
    score: ResilienceScore,
    snapshot: dict,
    client: AsyncAnthropic,
) -> tuple[str, str, float]:
    """
    Ask Claude to generate a coaching recommendation.
    Returns (reason, recommendation_text, expected_impact).
    PII boundary: only pseudonymised signals reach the LLM.
    """
    settings = get_settings()
    components = score.components

    # Find the weakest component to focus on
    weakest = min(
        [
            ("emergency_fund", components.emergency_fund),
            ("cash_flow", components.cash_flow),
            ("debt_burden", components.debt_burden),
            ("income_stability", components.income_stability),
            ("goal_readiness", components.goal_readiness),
        ],
        key=lambda x: x[1],
    )

    accounts = snapshot.get("accounts") or []
    goals = snapshot.get("goals") or []
    context_labels = snapshot.get("context_labels") or []

    prompt = f"""You are a financial resilience coach. Generate a single, specific, actionable recommendation.

CUSTOMER CONTEXT (anonymised):
- Context labels: {context_labels}
- Resilience Score: {score.overall}/100
- Weakest area: {weakest[0]} (score: {weakest[1]}/100)
- Active goals: {[g.get('goal_type') for g in goals]}
- Account types: {[a.get('account_type') for a in accounts]}

RULES:
- No investment advice
- No credit decisions
- No guarantees
- Educational guidance only
- Be specific with amounts when possible

Respond in JSON with exactly these fields:
{{
  "reason": "one sentence explaining why this recommendation was generated",
  "recommendation_text": "specific action the customer should take (max 12 words)",
  "expected_impact": "concrete outcome if they take this action (max 15 words)"
}}

JSON only. No other text."""

    start = time.time()
    response = await client.messages.create(
        model=settings.claude_model,
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    latency_ms = int((time.time() - start) * 1000)

    import json
    text = response.content[0].text.strip()
    try:
        parsed = json.loads(text)
        return (
            parsed.get("reason", "Resilience score indicates improvement opportunity"),
            parsed.get("recommendation_text", "Review your financial resilience score"),
            parsed.get("expected_impact", "Improve financial preparedness"),
        )
    except Exception:
        log.warning("assessment_agent.parse_failed", raw=text[:100])
        return (
            f"{weakest[0].replace('_', ' ').title()} score is below target",
            "Review and improve your weakest resilience area",
            "Improve overall Clarity Score",
        )


# ── AGENT ENTRY POINT ─────────────────────────────────────────────────────────

async def run_financial_assessment_agent(
    state: AgentState,
    session: AsyncSession,
    anthropic_client: AsyncAnthropic,
) -> AgentState:
    """
    Main agent function. Called by the LangGraph graph node.
    Mutates state with resilience_score and assessment_recommendation.
    """
    log.info("assessment_agent.start", hid=state.customer_hid[:8])
    start = time.time()
    settings = get_settings()

    try:
        # Compute score
        score = compute_score(state.snapshot)
        state.resilience_score = score

        # Generate coaching narrative via Claude
        reason, rec_text, impact = await _generate_coaching_narrative(
            score, state.snapshot, anthropic_client
        )

        # Confidence based on data richness
        txn_count = len(state.snapshot.get("transactions") or [])
        confidence = min(0.95, 0.70 + (txn_count / 100) * 0.25)

        # Only emit recommendation if above suppression threshold
        if confidence >= settings.confidence_present_caution:
            priority = Priority.HIGH if score.overall < 50 else Priority.MEDIUM
            rec = RecommendationObject(
                agent=AGENT_NAME,
                priority=priority,
                reason=reason,
                recommendation_text=rec_text,
                expected_impact=impact,
                confidence=confidence,
                requires_approval=True,
                session_id=state.session_id,
            )
            state.assessment_recommendation = rec

        # Write immutable score node to Neo4j
        import uuid
        score_id = str(uuid.uuid4())
        await run_write(
            session, WRITE_RESILIENCE_SCORE,
            hid=state.customer_hid,
            score_id=score_id,
            overall_score=score.overall,
            emergency_fund_score=score.components.emergency_fund,
            cash_flow_score=score.components.cash_flow,
            debt_burden_score=score.components.debt_burden,
            income_stability_score=score.components.income_stability,
            goal_readiness_score=score.components.goal_readiness,
            triggered_by=state.trigger,
            pg_score_id=score_id,
        )

        # Audit log
        latency_ms = int((time.time() - start) * 1000)
        prompt_hash = hashlib.sha256(state.customer_hid.encode()).hexdigest()[:16]
        output_hash = hashlib.sha256(rec_text.encode()).hexdigest()[:16]
        await run_write(
            session, LOG_AGENT_CALL,
            agent_name=AGENT_NAME,
            customer_hid=state.customer_hid,
            session_id=state.session_id,
            prompt_hash=prompt_hash,
            model_version=settings.claude_model,
            output_hash=output_hash,
            latency_ms=latency_ms,
        )

        log.info("assessment_agent.done", score=score.overall, latency_ms=latency_ms)

    except Exception as e:
        log.exception("assessment_agent.error", error=str(e))
        state.errors.append(f"FinancialAssessmentAgent: {str(e)}")

    return state
