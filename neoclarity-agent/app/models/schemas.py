"""
Shared data models for the NeoClarity agent layer.

Three categories:
  1. Standard Recommendation Object (ADR-003) — the contract between every
     agent and the Supervisor.
  2. LangGraph state — the typed dict threaded through the graph.
  3. API request / response — the Spring Boot ↔ FastAPI contract from the
     frozen architecture.
"""

from __future__ import annotations
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field
from uuid import uuid4


# ── 1. STANDARD RECOMMENDATION OBJECT (ADR-003) ──────────────────────────────

class Priority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RecommendationObject(BaseModel):
    """
    Standard Recommendation Object — every agent MUST emit this or None.
    The Supervisor ranks, deduplicates, and resolves conflicts across these.
    """
    recommendation_id: str = Field(default_factory=lambda: str(uuid4()))
    agent: str                          # FinancialAssessmentAgent | GoalPlanningAgent | EventIntelligenceAgent | SupervisorAgent
    priority: Priority
    reason: str                         # why it was generated
    recommendation_text: str            # action text shown to customer
    expected_impact: str                # e.g. "Reach target 4 months sooner"
    confidence: float = Field(ge=0.0, le=1.0)
    requires_approval: bool = True
    goal_id: Optional[str] = None       # links to a specific goal node
    session_id: str = ""

    class Config:
        use_enum_values = True


# ── 2. RESILIENCE SCORE COMPONENTS ───────────────────────────────────────────

class ResilienceComponents(BaseModel):
    emergency_fund: int = Field(ge=0, le=100)
    cash_flow: int = Field(ge=0, le=100)
    debt_burden: int = Field(ge=0, le=100)
    income_stability: int = Field(ge=0, le=100)
    goal_readiness: int = Field(ge=0, le=100)


class ResilienceScore(BaseModel):
    overall: int = Field(ge=0, le=100)
    components: ResilienceComponents
    score_id: str = Field(default_factory=lambda: str(uuid4()))


# ── 3. DETECTED LIFE EVENT ────────────────────────────────────────────────────

class DetectedEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: str                     # VACATION | HOME_RENO | MEDICAL | EDUCATION | CHILD_ACTIVITY
    label: str                          # AI-generated: "Yellowstone Family Vacation"
    total_cost: float
    transaction_count: int
    confidence: float = Field(ge=0.0, le=1.0)
    confirmed: bool = False
    date_range_start: Optional[str] = None
    date_range_end: Optional[str] = None
    transaction_ids: list[str] = Field(default_factory=list)


# ── 4. LANGGRAPH STATE ────────────────────────────────────────────────────────

class AgentState(BaseModel):
    """
    Typed state threaded through the LangGraph StateGraph.
    Each agent reads from this, adds its outputs, passes it forward.
    The Supervisor reads the full state to aggregate and rank.
    """
    # Input
    customer_hid: str
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    trigger: str = "ACCOUNT_LINK"      # ACCOUNT_LINK | REFRESH | MANUAL

    # Loaded from Neo4j by the graph entry node
    snapshot: dict[str, Any] = Field(default_factory=dict)

    # Agent outputs — each agent appends its recommendation(s)
    assessment_recommendation: Optional[RecommendationObject] = None
    goal_recommendations: list[RecommendationObject] = Field(default_factory=list)
    event_intelligence_recs: list[RecommendationObject] = Field(default_factory=list)

    # Computed scores and events
    resilience_score: Optional[ResilienceScore] = None
    detected_events: list[DetectedEvent] = Field(default_factory=list)

    # Supervisor output — the final ranked list delivered to Spring Boot
    ranked_recommendations: list[RecommendationObject] = Field(default_factory=list)
    next_best_action: Optional[RecommendationObject] = None

    # Error tracking — if an agent fails it sets its error here and the
    # Supervisor gracefully continues with the remaining agents' outputs
    errors: list[str] = Field(default_factory=list)


# ── 5. SPRING BOOT ↔ FASTAPI API CONTRACT ────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """Request from Spring Boot to POST /api/agent/analyze."""
    customer_hashed_id: str
    session_id: Optional[str] = None
    trigger: str = "ACCOUNT_LINK"


class RecommendationResponse(BaseModel):
    """Recommendation Object as serialised in the analyze response."""
    recommendation_id: str
    agent: str
    priority: str
    reason: str
    recommendation_text: str
    expected_impact: str
    confidence: float
    requires_approval: bool
    goal_id: Optional[str] = None
    session_id: str


class ResilienceScoreResponse(BaseModel):
    overall: int
    components: dict[str, int]


class DetectedEventResponse(BaseModel):
    event_id: str
    event_type: str
    label: str
    total_cost: float
    transaction_count: int
    confidence: float
    confirmed: bool
    date_range_start: Optional[str] = None
    date_range_end: Optional[str] = None


class AnalyzeResponse(BaseModel):
    """Response returned to Spring Boot — the frozen architecture contract."""
    session_id: str
    customer_hashed_id: str
    resilience_score: Optional[ResilienceScoreResponse] = None
    recommendations: list[RecommendationResponse] = Field(default_factory=list)
    next_best_action: Optional[RecommendationResponse] = None
    detected_events: list[DetectedEventResponse] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    stale: bool = False                 # True if this is a cached fallback response
