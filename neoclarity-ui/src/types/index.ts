// ── Auth ────────────────────────────────────────────────────────────────────
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MfaVerifyRequest {
  mfaToken: string;
  code: string;
}

export interface MfaRequiredResponse {
  mfaRequired: true;
  mfaToken: string;
  demoHint: string;
}

export interface CustomerSummary {
  id: number;
  hashedId: string;
  email: string;
  firstName: string;
  lastName: string;
  consentActive: boolean;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresInMs: number;
  customer: CustomerSummary;
}

// ── Accounts ─────────────────────────────────────────────────────────────────
export interface AccountResponse {
  accountId: string;
  institution: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'LOAN';
  balance: number;
  currency: string;
  active: boolean;
  lastRefreshedAt: string;
}

export interface NetWorthResponse {
  netWorth: number;
  accountCount: number;
}

// ── Goals ─────────────────────────────────────────────────────────────────────
export type GoalType = 'EMERGENCY_FUND' | 'VACATION' | 'COLLEGE' | 'DEBT_PAYOFF';
export type GoalStatus = 'ACTIVE' | 'ACHIEVED' | 'PAUSED' | 'CANCELLED';

export interface GoalResponse {
  goalId: string;
  goalType: GoalType;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  deadline: string | null;
  status: GoalStatus;
  progressPercent: number;
}

export interface GoalRequest {
  goalType: GoalType;
  targetAmount: number;
  currentAmount?: number;
  monthlyContribution?: number;
  deadline?: string;
}

// ── Resilience Score ──────────────────────────────────────────────────────────
export interface ResilienceScoreComponents {
  emergencyFund: number;
  cashFlow: number;
  debtBurden: number;
  incomeStability: number;
  goalReadiness: number;
}

export interface ResilienceScoreResponse {
  overall: number;
  components: ResilienceScoreComponents;
  computedAt: string;
}

// ── Recommendations ───────────────────────────────────────────────────────────
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type RecommendationResponse_Status = 'PENDING' | 'APPROVED' | 'DISMISSED' | 'REMIND_LATER';

export interface RecommendationResponse {
  recommendationId: string;
  agent: string;
  priority: Priority;
  reason: string;
  recommendationText: string;
  expectedImpact: string;
  confidence: number;
  requiresApproval: boolean;
  response: RecommendationResponse_Status;
  createdAt: string;
}

// ── Life Events ───────────────────────────────────────────────────────────────
export type EventType = 'VACATION' | 'HOME_RENO' | 'MEDICAL' | 'EDUCATION' | 'CELEBRATION' | 'CHILD_ACTIVITY';

export interface LifeEventResponse {
  eventId: string;
  eventType: EventType;
  label: string;
  totalCost: number;
  transactionCount: number;
  detectionConfidence: number;
  confirmed: boolean;
  confirmedAt: string | null;
  detectedAt: string;
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
}
