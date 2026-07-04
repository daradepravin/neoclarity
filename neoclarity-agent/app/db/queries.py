"""
All Cypher queries used by the NeoClarity agents.

Centralised here so:
  - queries are version-controlled independently of agent logic
  - the Cartesian-product-safe CALL subquery pattern is enforced everywhere
  - parameter names are explicit and typed

Each function returns a dict ready to pass as neo4j driver parameters.
"""

from neo4j import AsyncSession
from typing import Any


# ── READ QUERIES ─────────────────────────────────────────────────────────────

CUSTOMER_SNAPSHOT = """
MATCH (c:Customer {hashed_id: $hid})
WHERE c.consent_active = true

CALL {
  WITH c
  OPTIONAL MATCH (c)-[:HAS_ACCOUNT]->(a:Account {is_active: true})
  OPTIONAL MATCH (a)-[:CONTAINS]->(t:Transaction)
    WHERE t.transaction_date >= date() - duration('P90D')
  RETURN
    collect(DISTINCT {
      account_id: a.account_id,
      account_type: a.account_type,
      balance: a.balance,
      institution: a.institution
    }) AS accounts,
    collect(DISTINCT {
      id: t.transaction_id,
      amount: t.amount,
      category: t.category,
      date: toString(t.transaction_date),
      is_recurring: t.is_recurring,
      income_flag: t.income_flag,
      merchant: t.merchant_normalised
    }) AS transactions
}

CALL {
  WITH c
  OPTIONAL MATCH (c)-[:HAS_GOAL]->(g:Goal {status: 'ACTIVE'})
  RETURN collect(DISTINCT {
    goal_id: g.goal_id,
    goal_type: g.goal_type,
    target: g.target_amount,
    current: g.current_amount,
    monthly: g.monthly_contribution,
    deadline: toString(g.deadline)
  }) AS goals
}

CALL {
  WITH c
  OPTIONAL MATCH (c)-[:HAS_SCORE]->(rs:ResilienceScore)
  WITH rs ORDER BY rs.computed_at DESC LIMIT 1
  RETURN rs.overall_score AS last_score, rs.computed_at AS last_computed
}

CALL {
  WITH c
  OPTIONAL MATCH (c)-[:HAS_CONTEXT]->(cc:CustomerContext {confirmed: true})
    WHERE cc.revoked_at IS NULL
  RETURN collect(DISTINCT cc.label) AS context_labels
}

RETURN
  c.hashed_id AS customer_id,
  c.consent_active AS consent_active,
  accounts,
  transactions,
  goals,
  last_score,
  toString(last_computed) AS last_computed,
  context_labels
"""

SUPERVISOR_TWIN_SNAPSHOT = """
MATCH (c:Customer {hashed_id: $hid})
WHERE c.consent_active = true

CALL {
  WITH c
  OPTIONAL MATCH (c)-[:HAS_SCORE]->(rs:ResilienceScore)
  WITH rs ORDER BY rs.computed_at DESC LIMIT 1
  RETURN {
    overall: rs.overall_score,
    emergency_fund: rs.emergency_fund_score,
    cash_flow: rs.cash_flow_score,
    debt_burden: rs.debt_burden_score,
    income_stability: rs.income_stability_score,
    goal_readiness: rs.goal_readiness_score,
    computed_at: toString(rs.computed_at)
  } AS latest_score
}

CALL {
  WITH c
  OPTIONAL MATCH (c)-[:HAS_GOAL]->(g:Goal {status: 'ACTIVE'})
  RETURN collect(DISTINCT {
    goal_id: g.goal_id,
    type: g.goal_type,
    progress_pct: CASE WHEN g.target_amount > 0
      THEN round(g.current_amount * 100.0 / g.target_amount)
      ELSE 0 END
  }) AS active_goals
}

CALL {
  WITH c
  OPTIONAL MATCH (c)-[:TRIGGERED]->(e:LifeEvent {confirmed: true})
  RETURN collect(DISTINCT {type: e.event_type, label: e.label, cost: e.total_cost}) AS confirmed_events
}

CALL {
  WITH c
  OPTIONAL MATCH (c)-[recv:RECEIVED]->(r:Recommendation)
    WHERE r.created_at >= datetime() - duration('P30D')
  RETURN collect(DISTINCT {
    text: r.recommendation_text,
    priority: r.priority,
    response: recv.response
  }) AS recent_recommendations
}

CALL {
  WITH c
  OPTIONAL MATCH (c)-[:HAS_CONTEXT]->(cc:CustomerContext {confirmed: true})
    WHERE cc.revoked_at IS NULL
  RETURN collect(DISTINCT cc.label) AS context_labels
}

RETURN
  c.consent_active AS consent_active,
  latest_score,
  active_goals,
  confirmed_events,
  recent_recommendations,
  context_labels
"""

EVENT_VECTOR_SEARCH = """
CALL db.index.vector.queryNodes(
  'transaction-embeddings',
  $top_k,
  $embedding
) YIELD node AS t, score

MATCH (a:Account)-[:CONTAINS]->(t)
MATCH (c:Customer {hashed_id: $hid})-[:HAS_ACCOUNT]->(a)
WHERE NOT (t)-[:BELONGS_TO]->(:LifeEvent {confirmed: true})
  AND score > $threshold

RETURN
  t.transaction_id AS transaction_id,
  t.merchant_normalised AS merchant,
  t.category AS category,
  t.amount AS amount,
  toString(t.transaction_date) AS date,
  score AS similarity_score
ORDER BY score DESC
LIMIT 30
"""

# ── WRITE QUERIES ─────────────────────────────────────────────────────────────

WRITE_RESILIENCE_SCORE = """
MATCH (c:Customer {hashed_id: $hid})
CREATE (rs:ResilienceScore {
  score_id:               $score_id,
  overall_score:          $overall_score,
  emergency_fund_score:   $emergency_fund_score,
  cash_flow_score:        $cash_flow_score,
  debt_burden_score:      $debt_burden_score,
  income_stability_score: $income_stability_score,
  goal_readiness_score:   $goal_readiness_score,
  computed_at:            datetime(),
  triggered_by:           $triggered_by,
  pg_score_id:            $pg_score_id
})
CREATE (c)-[:HAS_SCORE {computed_at: datetime()}]->(rs)
RETURN rs.score_id AS created_score_id
"""

WRITE_RECOMMENDATION = """
MATCH (c:Customer {hashed_id: $hid})
MERGE (r:Recommendation {recommendation_id: $recommendation_id})
ON CREATE SET
  r.agent               = $agent,
  r.priority            = $priority,
  r.reason              = $reason,
  r.recommendation_text = $recommendation_text,
  r.expected_impact     = $expected_impact,
  r.confidence          = $confidence,
  r.requires_approval   = $requires_approval,
  r.session_id          = $session_id,
  r.created_at          = datetime(),
  r.pg_recommendation_id = $pg_recommendation_id
MERGE (c)-[:RECEIVED]->(r)
ON CREATE SET r.response = 'PENDING'

WITH r
CALL (r) {
  MATCH (g:Goal {goal_id: $goal_id})
  WHERE $goal_id IS NOT NULL
  MERGE (r)-[:GOAL_LINKED]->(g)
}

RETURN r.recommendation_id AS created_rec_id
"""

WRITE_LIFE_EVENT = """
MATCH (c:Customer {hashed_id: $hid})
CREATE (e:LifeEvent {
  event_id:             $event_id,
  event_type:           $event_type,
  label:                $label,
  total_cost:           $total_cost,
  transaction_count:    $transaction_count,
  detection_confidence: $confidence,
  confirmed:            false,
  detected_at:          datetime(),
  date_range_start:     date($date_start),
  date_range_end:       date($date_end),
  pg_event_id:          $pg_event_id
})
CREATE (c)-[:TRIGGERED {detected_at: datetime()}]->(e)
WITH e
UNWIND $transaction_ids AS txn_id
  MATCH (t:Transaction {transaction_id: txn_id})
  CREATE (t)-[:BELONGS_TO {confirmed_at: null}]->(e)
RETURN e.event_id AS created_event_id
"""

LOG_AGENT_CALL = """
CREATE (l:AgentCallLog {
  agent_name:    $agent_name,
  customer_hid:  $customer_hid,
  session_id:    $session_id,
  prompt_hash:   $prompt_hash,
  model_version: $model_version,
  output_hash:   $output_hash,
  latency_ms:    $latency_ms,
  created_at:    datetime()
})
"""


# ── HELPER ───────────────────────────────────────────────────────────────────

async def run_read(session: AsyncSession, query: str, **params) -> list[dict]:
    """Execute a read query and return records as plain dicts."""
    result = await session.run(query, **params)
    records = await result.data()
    return records


async def run_write(session: AsyncSession, query: str, **params) -> dict[str, Any] | None:
    """Execute a write query and return the first record (or None)."""
    result = await session.run(query, **params)
    records = await result.data()
    return records[0] if records else None
