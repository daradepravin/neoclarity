import api from './client';
import type {
  RegisterRequest, LoginRequest, MfaVerifyRequest,
  AuthResponse, MfaRequiredResponse, CustomerSummary,
  AccountResponse, NetWorthResponse,
  GoalResponse, GoalRequest,
  ResilienceScoreResponse,
  RecommendationResponse,
  LifeEventResponse,
} from '../types';

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<AuthResponse>('/auth/register', data).then(r => r.data),

  login: (data: LoginRequest) =>
    api.post<AuthResponse | MfaRequiredResponse>('/auth/login', data).then(r => r.data),

  verifyMfa: (data: MfaVerifyRequest) =>
    api.post<AuthResponse>('/auth/verify-mfa', data).then(r => r.data),

  me: () =>
    api.get<CustomerSummary>('/auth/me').then(r => r.data),

  updateConsent: (active: boolean) =>
    api.put<CustomerSummary>('/auth/consent', { active }).then(r => r.data),
};

// ── Accounts ─────────────────────────────────────────────────────────────────
export const accountApi = {
  list: () =>
    api.get<AccountResponse[]>('/accounts').then(r => r.data),

  netWorth: () =>
    api.get<NetWorthResponse>('/accounts/net-worth').then(r => r.data),
};

// ── Goals ─────────────────────────────────────────────────────────────────────
export const goalApi = {
  list: () =>
    api.get<GoalResponse[]>('/goals').then(r => r.data),

  create: (data: GoalRequest) =>
    api.post<GoalResponse>('/goals', data).then(r => r.data),

  update: (goalId: string, data: Partial<GoalRequest>) =>
    api.put<GoalResponse>(`/goals/${goalId}`, data).then(r => r.data),

  pause: (goalId: string) =>
    api.patch<GoalResponse>(`/goals/${goalId}/pause`).then(r => r.data),

  resume: (goalId: string) =>
    api.patch<GoalResponse>(`/goals/${goalId}/resume`).then(r => r.data),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  resilienceScore: () =>
    api.get<ResilienceScoreResponse>('/dashboard/resilience-score').then(r => r.data),

  resilienceHistory: () =>
    api.get<ResilienceScoreResponse[]>('/dashboard/resilience-score/history').then(r => r.data),
};

// ── Recommendations ───────────────────────────────────────────────────────────
export const recommendationApi = {
  list: () =>
    api.get<RecommendationResponse[]>('/recommendations').then(r => r.data),

  nextBestAction: () =>
    api.get<RecommendationResponse>('/recommendations/next-best-action').then(r => r.data),

  respond: (recommendationId: string, response: 'APPROVED' | 'DISMISSED' | 'REMIND_LATER') =>
    api.patch<RecommendationResponse>(`/recommendations/${recommendationId}`, { response }).then(r => r.data),
};

// ── Life Events ───────────────────────────────────────────────────────────────
export const eventApi = {
  list: () =>
    api.get<LifeEventResponse[]>('/events').then(r => r.data),

  confirm: (eventId: string) =>
    api.post<LifeEventResponse>(`/events/${eventId}/confirm`).then(r => r.data),

  reject: (eventId: string) =>
    api.post<LifeEventResponse>(`/events/${eventId}/reject`).then(r => r.data),
};
