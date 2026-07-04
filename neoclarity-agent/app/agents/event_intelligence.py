"""
Event Intelligence Agent

Responsibilities (FR-6.1–6.5):
  - Detect life event clusters from transaction patterns
  - Uses Neo4j vector index similarity search (cosine > 0.78)
  - Falls back to rule-based category+merchant detection when vector
    index is not yet populated
  - Creates unconfirmed LifeEvent nodes for customer confirmation
  - The Yellowstone example is the canonical demo flow
"""

import time
import json
import structlog
from uuid import uuid4
from collections import defaultdict

from anthropic import AsyncAnthropic
from neo4j import AsyncSession
from sentence_transformers import SentenceTransformer

from app.config import get_settings
from app.db.queries import run_read, run_write, EVENT_VECTOR_SEARCH, WRITE_LIFE_EVENT
from app.models.schemas import AgentState, DetectedEvent, RecommendationObject, Priority

log = structlog.get_logger(__name__)
AGENT_NAME = "EventIntelligenceAgent"

# Loaded once at module level — 384-dim all-MiniLM-L6-v2
_embedder: SentenceTransformer | None = None

def get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        log.info("event_agent.loading_embedder")
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
    return _embedder


# ── RULE-BASED DETECTION (fallback) ──────────────────────────────────────────

EVENT_PATTERNS = {
    "VACATION": {
        "categories": {"Travel"},
        "merchants": {"united airlines", "delta", "american airlines", "southwest",
                       "hertz", "enterprise", "avis", "marriott", "hilton",
                       "yellowstone", "airbnb", "expedia"},
    },
    "HOME_RENO": {
        "categories": {"Home Improvement", "Shopping"},
        "merchants": {"home depot", "lowe's", "ace hardware", "ikea"},
    },
    "MEDICAL": {
        "categories": {"Healthcare", "Medical"},
        "merchants": {"cvs", "walgreens", "urgent care", "hospital"},
    },
    "CHILD_ACTIVITY": {
        "categories": {"Education", "Sports"},
        "merchants": {"kumon", "karate", "soccer", "swim", "little league"},
    },
}


def _rule_based_detection(transactions: list[dict]) -> list[dict]:
    """Group transactions into event clusters by pattern matching."""
    clusters: dict[str, list[dict]] = defaultdict(list)

    for t in transactions:
        merchant = (t.get("merchant") or "").lower()
        category = t.get("category") or ""

        for event_type, pattern in EVENT_PATTERNS.items():
            if category in pattern["categories"] or any(m in merchant for m in pattern["merchants"]):
                clusters[event_type].append(t)
                break

    return [
        {"event_type": k, "transactions": v}
        for k, v in clusters.items()
        if len(v) >= 2  # minimum 2 transactions to form an event
    ]


# ── LABEL GENERATION ──────────────────────────────────────────────────────────

async def _generate_event_label(
    event_type: str,
    transactions: list[dict],
    client: AsyncAnthropic,
) -> str:
    settings = get_settings()
    merchants = list({t.get("merchant", "") for t in transactions})[:6]
    total = sum(abs(t.get("amount", 0)) for t in transactions)
    dates = sorted([t.get("date", "")[:10] for t in transactions if t.get("date")])

    prompt = f"""Generate a short, friendly name for this financial event.

Event type: {event_type}
Merchants involved: {merchants}
Total cost: ${total:,.0f}
Date range: {dates[0] if dates else 'unknown'} to {dates[-1] if dates else 'unknown'}

Examples: "Yellowstone Family Vacation", "Kitchen Renovation", "Soccer Season Spring 2026"

Respond with ONLY the event label (max 5 words). No quotes, no punctuation at end."""

    response = await client.messages.create(
        model=settings.claude_model,
        max_tokens=20,
        messages=[{"role": "user", "content": prompt}],
    )
    label = response.content[0].text.strip().strip('"\'')
    return label if label else event_type.replace("_", " ").title()


# ── AGENT ENTRY POINT ─────────────────────────────────────────────────────────

async def run_event_intelligence_agent(
    state: AgentState,
    session: AsyncSession,
    anthropic_client: AsyncAnthropic,
) -> AgentState:
    log.info("event_agent.start", hid=state.customer_hid[:8])
    start = time.time()
    settings = get_settings()

    try:
        transactions = (state.snapshot or {}).get("transactions") or []
        if not transactions:
            log.info("event_agent.no_transactions")
            return state

        detected_clusters = []

        # Try vector search first (requires Neo4j vector index populated)
        try:
            embedder = get_embedder()
            # Use a "travel cluster" seed query to find the Yellowstone pattern
            seed_text = "airline hotel car rental vacation travel accommodation"
            seed_embedding = embedder.encode(seed_text).tolist()

            vector_results = await run_read(
                session, EVENT_VECTOR_SEARCH,
                hid=state.customer_hid,
                embedding=seed_embedding,
                top_k=20,
                threshold=settings.event_similarity_threshold,
            )

            if vector_results and len(vector_results) >= settings.event_cluster_min_transactions:
                # Group by category proximity
                travel_txns = [r for r in vector_results if r.get("category") in ("Travel", "Dining")]
                if len(travel_txns) >= 2:
                    detected_clusters.append({
                        "event_type": "VACATION",
                        "transactions": [
                            {
                                "transaction_id": r["transaction_id"],
                                "merchant": r["merchant"],
                                "amount": r["amount"],
                                "date": r["date"],
                            }
                            for r in travel_txns
                        ],
                        "source": "vector",
                    })
                    log.info("event_agent.vector_cluster_found", count=len(travel_txns))

        except Exception as ve:
            log.warning("event_agent.vector_search_failed", error=str(ve))
            # Fall through to rule-based

        # Rule-based fallback / supplement
        if not detected_clusters:
            rule_clusters = _rule_based_detection(transactions)
            for c in rule_clusters:
                c["source"] = "rules"
            detected_clusters.extend(rule_clusters)
            log.info("event_agent.rule_clusters", count=len(rule_clusters))

        # Process each detected cluster
        for cluster in detected_clusters[:3]:  # max 3 events per session
            event_type = cluster["event_type"]
            cluster_txns = cluster["transactions"]

            total_cost = sum(abs(t.get("amount", 0)) for t in cluster_txns)
            dates = sorted([t.get("date", "")[:10] for t in cluster_txns if t.get("date")])

            # Confidence: vector search gives higher confidence than rules
            confidence = 0.87 if cluster.get("source") == "vector" else 0.72

            if confidence < settings.confidence_present_caution:
                continue

            label = await _generate_event_label(event_type, cluster_txns, anthropic_client)

            event = DetectedEvent(
                event_type=event_type,
                label=label,
                total_cost=total_cost,
                transaction_count=len(cluster_txns),
                confidence=confidence,
                confirmed=False,
                date_range_start=dates[0] if dates else None,
                date_range_end=dates[-1] if dates else None,
                transaction_ids=[t.get("transaction_id", "") for t in cluster_txns
                                  if t.get("transaction_id")],
            )
            state.detected_events.append(event)

            # Write unconfirmed LifeEvent node to Neo4j
            try:
                await run_write(
                    session, WRITE_LIFE_EVENT,
                    hid=state.customer_hid,
                    event_id=event.event_id,
                    event_type=event.event_type,
                    label=event.label,
                    total_cost=event.total_cost,
                    transaction_count=event.transaction_count,
                    confidence=event.confidence,
                    date_start=event.date_range_start or str(time.strftime("%Y-%m-%d")),
                    date_end=event.date_range_end or str(time.strftime("%Y-%m-%d")),
                    transaction_ids=event.transaction_ids,
                    pg_event_id=event.event_id,
                )
            except Exception as we:
                log.warning("event_agent.write_failed", error=str(we))

        latency_ms = int((time.time() - start) * 1000)
        log.info("event_agent.done", events=len(state.detected_events), latency_ms=latency_ms)

    except Exception as e:
        log.exception("event_agent.error", error=str(e))
        state.errors.append(f"EventIntelligenceAgent: {str(e)}")

    return state
