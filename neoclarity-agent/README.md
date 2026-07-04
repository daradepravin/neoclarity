# NeoClarity Agent Layer (FastAPI + LangGraph)

Four agents + Supervisor orchestrated via LangGraph StateGraph.
Called by Spring Boot via POST /api/agent/analyze.

## Quick start

```bash
# 1. Copy env template
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, NEO4J_URI, NEO4J_PASSWORD

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run
uvicorn app.main:app --reload --port 8000
```

## Verify
```bash
# Health
curl http://localhost:8000/health

# Neo4j connectivity
curl http://localhost:8000/health/neo4j

# Full analysis (replace with a real hashed_id from your demo customer)
curl -X POST http://localhost:8000/api/agent/analyze \
  -H "Content-Type: application/json" \
  -d '{"customer_hashed_id": "<hashed_id>", "trigger": "MANUAL"}'
```

## Agents
1. **FinancialAssessmentAgent** — computes 5-component Resilience Score
2. **GoalPlanningAgent** — goal-connected recommendations
3. **EventIntelligenceAgent** — detects life events (Yellowstone!)
4. **SupervisorAgent** — ranks, deduplicates, emits Next Best Action

## Getting the demo hashed_id
```sql
SELECT hashed_id FROM customers WHERE email = 'demo@neoclarity.app';
```
