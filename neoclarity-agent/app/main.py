"""
NeoClarity Agent Layer — FastAPI application

Single endpoint: POST /api/agent/analyze
Called by Spring Boot after account linking or on-demand refresh.
Returns the frozen architecture AnalyzeResponse contract.

Auth: requires X-Agent-Secret header matching AGENT_SHARED_SECRET env var.
Only Spring Boot should hold this secret — the agent layer is an internal
service, never exposed to browsers.
"""

import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from anthropic import AsyncAnthropic

from app.config import get_settings
from app.db.neo4j_client import init_driver, close_driver, get_driver
from app.graph.workflow import run_analysis
from app.agents.supervisor import build_analyze_response
from app.models.schemas import AnalyzeRequest, AnalyzeResponse

log = structlog.get_logger(__name__)

# Module-level Anthropic client — one instance shared across requests
_anthropic_client: AsyncAnthropic | None = None


async def verify_agent_secret(x_agent_secret: str | None = Header(default=None)):
    """Shared-secret check between Spring Boot and the agent layer."""
    settings = get_settings()
    expected = settings.agent_shared_secret
    if expected and x_agent_secret != expected:
        log.warning("auth.rejected_missing_or_bad_secret")
        raise HTTPException(status_code=401, detail="Invalid or missing X-Agent-Secret header")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init Neo4j driver + Anthropic client. Shutdown: close driver."""
    global _anthropic_client
    settings = get_settings()

    log.info("startup.begin")
    await init_driver()
    _anthropic_client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    log.info("startup.complete", model=settings.claude_model)

    yield

    log.info("shutdown.begin")
    await close_driver()
    log.info("shutdown.complete")


app = FastAPI(
    title="NeoClarity Agent Layer",
    description="LangGraph multi-agent orchestration for Financial Wellness Hub",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],   # Spring Boot only
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── HEALTH ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "neoclarity-agent"}


@app.get("/health/neo4j")
async def health_neo4j():
    """Verify Neo4j AuraDB connectivity."""
    try:
        driver = get_driver()
        async with driver.session() as session:
            result = await session.run("RETURN 1 AS ok")
            await result.data()
        return {"status": "ok", "neo4j": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Neo4j unavailable: {e}")


# ── CORE ENDPOINT ─────────────────────────────────────────────────────────────

@app.post("/api/agent/analyze", response_model=AnalyzeResponse)
async def analyze(
    request: AnalyzeRequest,
    _auth: None = Depends(verify_agent_secret),
) -> AnalyzeResponse:
    """
    Main analysis endpoint — called by Spring Boot.

    Orchestrates all four agents via LangGraph and returns:
      - Financial Resilience Score (5 components)
      - Ranked recommendations (max 3)
      - Next Best Action
      - Detected life events (unconfirmed)

    On any unhandled error returns a graceful stale=True fallback response
    per the frozen architecture NFR: graceful degradation when AI unavailable.
    """
    log.info("analyze.request",
             hid=request.customer_hashed_id[:8],
             trigger=request.trigger)

    try:
        driver = get_driver()

        async with driver.session() as session:
            final_state = await run_analysis(
                customer_hid=request.customer_hashed_id,
                session=session,
                anthropic_client=_anthropic_client,
                session_id=request.session_id,
                trigger=request.trigger,
            )

        response = build_analyze_response(final_state)
        log.info("analyze.response",
                 hid=request.customer_hashed_id[:8],
                 score=response.resilience_score.overall if response.resilience_score else None,
                 recs=len(response.recommendations),
                 events=len(response.detected_events))
        return response

    except Exception as e:
        log.exception("analyze.unhandled_error", error=str(e))
        # Graceful degradation — return a stale flag so Spring Boot
        # can serve the last cached Twin snapshot instead of a 500
        return AnalyzeResponse(
            session_id=request.session_id or "",
            customer_hashed_id=request.customer_hashed_id,
            errors=[f"Agent layer error: {str(e)}"],
            stale=True,
        )
