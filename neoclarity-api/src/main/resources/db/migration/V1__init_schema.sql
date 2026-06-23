-- ============================================================================
-- NeoClarity — PostgreSQL Schema v1 (System of Record)
-- Maps directly to Neo4j Household Digital Twin via pg_*_id foreign keys
-- ============================================================================

-- ── Customers (auth + consent) ──────────────────────────────────────────────
CREATE TABLE customers (
    id              BIGSERIAL PRIMARY KEY,
    hashed_id       VARCHAR(64) NOT NULL UNIQUE,   -- SHA-256, mirrored to Neo4j Customer.hashed_id
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    mfa_enabled     BOOLEAN NOT NULL DEFAULT true,
    mfa_demo_code   VARCHAR(6) NOT NULL DEFAULT '123456', -- MVP: simulated MFA (see frozen ADR Section 2.1)
    consent_active  BOOLEAN NOT NULL DEFAULT false,
    consent_granted_at  TIMESTAMP,
    consent_revoked_at  TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_hashed_id ON customers(hashed_id);

-- ── Customer Context (confirmed persona labels) ─────────────────────────────
CREATE TABLE customer_context (
    id              BIGSERIAL PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    label           VARCHAR(50) NOT NULL,   -- PARENT | HOMEOWNER | CAREGIVER | STUDENT | SELF_EMPLOYED | MARRIED
    confirmed       BOOLEAN NOT NULL DEFAULT true,
    confirmed_at    TIMESTAMP NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMP,
    UNIQUE (customer_id, label)
);

-- ── Accounts (linked financial accounts — mock Open Banking) ────────────────
CREATE TABLE accounts (
    id              BIGSERIAL PRIMARY KEY,
    account_id      VARCHAR(64) NOT NULL UNIQUE,   -- hashed account identifier, mirrored to Neo4j
    customer_id     BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    institution     VARCHAR(100) NOT NULL,         -- e.g. Chase, Ally
    account_type    VARCHAR(20) NOT NULL CHECK (account_type IN ('CHECKING','SAVINGS','CREDIT','LOAN')),
    balance         NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    linked_at       TIMESTAMP NOT NULL DEFAULT now(),
    last_refreshed_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_customer ON accounts(customer_id);

-- ── Transactions (90-day rolling, dual-written to Neo4j w/ embeddings) ──────
CREATE TABLE transactions (
    id                  BIGSERIAL PRIMARY KEY,
    transaction_id      VARCHAR(64) NOT NULL UNIQUE,
    account_id          BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    amount              NUMERIC(12,2) NOT NULL,        -- positive = credit, negative = debit
    merchant_raw        VARCHAR(255) NOT NULL,
    merchant_normalised VARCHAR(255),
    category            VARCHAR(50),
    subcategory         VARCHAR(50),
    transaction_date    DATE NOT NULL,
    is_recurring        BOOLEAN NOT NULL DEFAULT false,
    income_flag         BOOLEAN NOT NULL DEFAULT false,
    confidence          NUMERIC(3,2) DEFAULT 1.0,
    neo4j_synced        BOOLEAN NOT NULL DEFAULT false,   -- ingest retries until embedding written to Neo4j
    created_at          TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_sync ON transactions(neo4j_synced) WHERE neo4j_synced = false;

-- ── Goals ────────────────────────────────────────────────────────────────────
CREATE TABLE goals (
    id                  BIGSERIAL PRIMARY KEY,
    goal_id             VARCHAR(64) NOT NULL UNIQUE,
    customer_id         BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    goal_type           VARCHAR(30) NOT NULL CHECK (goal_type IN ('EMERGENCY_FUND','VACATION','COLLEGE','DEBT_PAYOFF')),
    target_amount       NUMERIC(12,2) NOT NULL,
    current_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    monthly_contribution NUMERIC(10,2) NOT NULL DEFAULT 0,
    deadline            DATE,
    status              VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ACHIEVED','PAUSED','CANCELLED')),
    created_at          TIMESTAMP NOT NULL DEFAULT now(),
    achieved_at         TIMESTAMP
);

CREATE INDEX idx_goals_customer ON goals(customer_id);
CREATE INDEX idx_goals_status ON goals(status);

-- ── Resilience Scores (immutable history) ───────────────────────────────────
CREATE TABLE resilience_scores (
    id                          BIGSERIAL PRIMARY KEY,
    score_id                    VARCHAR(64) NOT NULL UNIQUE,
    customer_id                 BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    overall_score               INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
    emergency_fund_score        INTEGER NOT NULL,
    cash_flow_score             INTEGER NOT NULL,
    debt_burden_score           INTEGER NOT NULL,
    income_stability_score      INTEGER NOT NULL,
    goal_readiness_score        INTEGER NOT NULL,
    triggered_by                VARCHAR(20) NOT NULL DEFAULT 'ACCOUNT_LINK' CHECK (triggered_by IN ('ACCOUNT_LINK','REFRESH','MANUAL')),
    computed_at                 TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_scores_customer ON resilience_scores(customer_id, computed_at DESC);

-- ── Life Events ──────────────────────────────────────────────────────────────
CREATE TABLE life_events (
    id                  BIGSERIAL PRIMARY KEY,
    event_id            VARCHAR(64) NOT NULL UNIQUE,
    customer_id         BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    event_type          VARCHAR(30) NOT NULL CHECK (event_type IN ('VACATION','HOME_RENO','MEDICAL','EDUCATION','CELEBRATION','CHILD_ACTIVITY')),
    label               VARCHAR(255) NOT NULL,
    total_cost          NUMERIC(12,2) NOT NULL DEFAULT 0,
    transaction_count   INTEGER NOT NULL DEFAULT 0,
    detection_confidence NUMERIC(3,2) NOT NULL,
    confirmed           BOOLEAN NOT NULL DEFAULT false,
    confirmed_at        TIMESTAMP,
    detected_at         TIMESTAMP NOT NULL DEFAULT now(),
    date_range_start    DATE,
    date_range_end      DATE
);

CREATE INDEX idx_events_customer ON life_events(customer_id);
CREATE INDEX idx_events_confirmed ON life_events(confirmed);

-- ── Recommendations (immutable; Standard Recommendation Object) ─────────────
CREATE TABLE recommendations (
    id                  BIGSERIAL PRIMARY KEY,
    recommendation_id   VARCHAR(64) NOT NULL UNIQUE,
    customer_id         BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    agent               VARCHAR(50) NOT NULL,   -- FinancialAssessmentAgent | GoalPlanningAgent | EventIntelligenceAgent | SupervisorAgent
    priority            VARCHAR(10) NOT NULL CHECK (priority IN ('CRITICAL','HIGH','MEDIUM','LOW')),
    reason              TEXT NOT NULL,
    recommendation_text TEXT NOT NULL,
    expected_impact     TEXT,
    confidence          NUMERIC(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    requires_approval   BOOLEAN NOT NULL DEFAULT true,
    goal_id             BIGINT REFERENCES goals(id),
    session_id          VARCHAR(64),
    response            VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (response IN ('PENDING','APPROVED','DISMISSED','REMIND_LATER')),
    responded_at        TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendations_customer ON recommendations(customer_id);
CREATE INDEX idx_recommendations_priority ON recommendations(priority);
CREATE INDEX idx_recommendations_response ON recommendations(response);

-- ── Agent call log (observability / SR 11-7 style audit) ────────────────────
CREATE TABLE agent_call_log (
    id              BIGSERIAL PRIMARY KEY,
    agent_name      VARCHAR(50) NOT NULL,
    customer_id     BIGINT REFERENCES customers(id),
    session_id      VARCHAR(64),
    prompt_hash     VARCHAR(64),
    model_version   VARCHAR(50),
    output_hash     VARCHAR(64),
    latency_ms      INTEGER,
    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_log_customer ON agent_call_log(customer_id);
