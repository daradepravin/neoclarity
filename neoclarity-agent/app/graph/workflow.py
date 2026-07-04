"""
NeoClarity LangGraph StateGraph

Topology:
  load_snapshot
      │
      ├─► financial_assessment  ─┐
      ├─► goal_planning          ├─► supervisor ─► END
      └─► event_intelligence    ─┘

The three specialist agents run sequentially (not parallel) to keep the
implementation simple for the 8-week build. The state is passed between
nodes as a mutable Pydantic model. If any specialist agent fails it appends
to state.errors and the Supervisor continues with partial results.
"""

import structlog
from langgraph.graph import StateGraph, END
from anthropic import AsyncAnthropic
from neo4j import AsyncSession

from app.agents.financial_assessment import run_financial_assessment_agent
from app.agents.goal_planning import run_goal_planning_agent
from app.agents.event_intelligence import run_event_intelligence_agent
from app.agents.supervisor import run_supervisor_agent
from app.db.queries import run_read, CUSTOMER_SNAPSHOT
from app.models.schemas import AgentState

log = structlog.get_logger(__name__)


def build_graph(session: AsyncSession, anthropic_client: AsyncAnthropic):
    """
    Build and compile the LangGraph StateGraph.

    session and anthropic_client are injected at graph-build time
    (not via LangGraph dependency injection, which is not available
    in LangGraph 0.2.x for async sessions).
    """

    # LangGraph requires a plain dict state type.
    # We convert our Pydantic AgentState to/from dict at the boundary.

    async def load_snapshot_node(state: dict) -> dict:
        agent_state = AgentState(**state)
        log.info("graph.load_snapshot", hid=agent_state.customer_hid[:8])
        records = await run_read(session, CUSTOMER_SNAPSHOT, hid=agent_state.customer_hid)
        if records and records[0].get("consent_active"):
            agent_state.snapshot = records[0]
        else:
            agent_state.errors.append("Snapshot: consent not active or customer not found in Neo4j")
        return agent_state.model_dump()

    async def assessment_node(state: dict) -> dict:
        agent_state = AgentState(**state)
        result = await run_financial_assessment_agent(agent_state, session, anthropic_client)
        return result.model_dump()

    async def goal_node(state: dict) -> dict:
        agent_state = AgentState(**state)
        result = await run_goal_planning_agent(agent_state, session, anthropic_client)
        return result.model_dump()

    async def event_node(state: dict) -> dict:
        agent_state = AgentState(**state)
        result = await run_event_intelligence_agent(agent_state, session, anthropic_client)
        return result.model_dump()

    async def supervisor_node(state: dict) -> dict:
        agent_state = AgentState(**state)
        result = await run_supervisor_agent(agent_state, session)
        return result.model_dump()

    # Build the graph
    graph = StateGraph(dict)

    graph.add_node("load_snapshot", load_snapshot_node)
    graph.add_node("financial_assessment", assessment_node)
    graph.add_node("goal_planning", goal_node)
    graph.add_node("event_intelligence", event_node)
    graph.add_node("supervisor", supervisor_node)

    # Entry point
    graph.set_entry_point("load_snapshot")

    # Sequential edges
    graph.add_edge("load_snapshot", "financial_assessment")
    graph.add_edge("financial_assessment", "goal_planning")
    graph.add_edge("goal_planning", "event_intelligence")
    graph.add_edge("event_intelligence", "supervisor")
    graph.add_edge("supervisor", END)

    return graph.compile()


async def run_analysis(
    customer_hid: str,
    session: AsyncSession,
    anthropic_client: AsyncAnthropic,
    session_id: str | None = None,
    trigger: str = "ACCOUNT_LINK",
) -> AgentState:
    """
    Entry point called by the FastAPI endpoint.
    Returns the final AgentState with all agent outputs.
    """
    from uuid import uuid4
    sid = session_id or str(uuid4())

    initial_state = AgentState(
        customer_hid=customer_hid,
        session_id=sid,
        trigger=trigger,
    )

    graph = build_graph(session, anthropic_client)

    log.info("graph.run_start", hid=customer_hid[:8], session_id=sid)
    result = await graph.ainvoke(initial_state.model_dump())
    log.info("graph.run_done", hid=customer_hid[:8])

    return AgentState(**result)
