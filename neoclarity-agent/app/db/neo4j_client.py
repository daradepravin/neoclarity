"""
Neo4j AuraDB connection management.

Provides an async-compatible session factory.
The driver is a module-level singleton — created once on startup,
closed on shutdown via FastAPI lifespan.
"""

import structlog
from neo4j import AsyncGraphDatabase, AsyncDriver
from app.config import get_settings

log = structlog.get_logger()

_driver: AsyncDriver | None = None


async def init_driver() -> AsyncDriver:
    """Create the AuraDB driver. Called in FastAPI lifespan startup."""
    global _driver
    settings = get_settings()
    _driver = AsyncGraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_username, settings.neo4j_password),
        max_connection_pool_size=20,
    )
    # Verify connectivity
    await _driver.verify_connectivity()
    log.info("neo4j.connected", uri=settings.neo4j_uri)
    return _driver


async def close_driver() -> None:
    """Close the driver. Called in FastAPI lifespan shutdown."""
    global _driver
    if _driver:
        await _driver.close()
        log.info("neo4j.disconnected")


def get_driver() -> AsyncDriver:
    if _driver is None:
        raise RuntimeError("Neo4j driver not initialised — call init_driver() first")
    return _driver
