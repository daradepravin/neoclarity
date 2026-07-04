"""
NeoClarity Agent Layer — configuration.

Values come from environment variables or a .env file.
Never commit .env — add it to .gitignore.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── Anthropic ───────────────────────────────────────────────────────────
    anthropic_api_key: str

    # Claude model — Sonnet 4 as per frozen architecture
    claude_model: str = "claude-sonnet-4-6"
    claude_max_tokens: int = 1024

    # ── Neo4j AuraDB ────────────────────────────────────────────────────────
    neo4j_uri: str           # bolt+ssc://xxxxx.databases.neo4j.io:7687
    neo4j_username: str = "neo4j"
    neo4j_password: str

    # ── FastAPI ─────────────────────────────────────────────────────────────
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # ── Confidence thresholds (frozen architecture AI governance) ───────────
    confidence_present_normally: float = 0.90   # >= present normally
    confidence_present_caution: float = 0.70    # >= present with caution label
    # < 0.70 → suppress recommendation entirely

    # ── Event detection ─────────────────────────────────────────────────────
    event_similarity_threshold: float = 0.78    # cosine similarity for vector search
    event_cluster_min_transactions: int = 2     # min txns to form an event cluster

    # ── Scoring weights (must sum to 1.0) ────────────────────────────────────
    weight_emergency_fund: float = 0.30
    weight_cash_flow: float = 0.25
    weight_debt_burden: float = 0.20
    weight_income_stability: float = 0.15
    weight_goal_readiness: float = 0.10

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
