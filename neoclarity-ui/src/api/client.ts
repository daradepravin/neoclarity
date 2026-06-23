import axios from 'axios'

export interface CustomerSummary {
  id: number; hashedId: string; email: string
  firstName: string; lastName: string; consentActive: boolean
}
export interface AuthResponse {
  token: string; tokenType: string; expiresInMs: number; customer: CustomerSummary
}
export interface MfaRequiredResponse {
  mfaRequired: true; mfaToken: string; demoHint: string
}
export interface ResilienceScoreComponents {
  emergencyFund: number; cashFlow: number; debtBurden: number
  incomeStability: number; goalReadiness: number
}
export interface ResilienceScore {
  overall: number; components: ResilienceScoreComponents; computedAt: string
}
export interface Account {
  accountId: string; institution: string
  accountType: 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'LOAN'
  balance: number; currency: string; active: boolean; lastRefreshedAt: string
}
export interface NetWorth { netWorth: number; accountCount: number }
export interface Goal {
  goalId: string; goalType: string; targetAmount: number
  currentAmount: number; monthlyContribution: number
  deadline: string | null; status: string; progressPercent: number
}
export interface Recommendation {
  recommendationId: string; agent: string
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  reason: string; recommendationText: string; expectedImpact: string
  confidence: number; requiresApproval: boolean
  response: 'PENDING' | 'APPROVED' | 'DISMISSED' | 'REMIND_LATER'
  createdAt: string
}
export interface LifeEvent {
  eventId: string; eventType: string; label: string; totalCost: number
  transactionCount: number; detectionConfidence: number; confirmed: boolean
  confirmedAt: string | null; detectedAt: string
  dateRangeStart: string; dateRangeEnd: string
}

const api = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nc_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('nc_token')
    window.location.href = '/login'
  }
  return Promise.reject(err)
})

export const authApi = {
  register: (email: string, password: string, firstName: string, lastName: string) =>
    api.post<AuthResponse>('/auth/register', { email, password, firstName, lastName }),
  login: (email: string, password: string) =>
    api.post<AuthResponse | MfaRequiredResponse>('/auth/login', { email, password }),
  verifyMfa: (mfaToken: string, code: string) =>
    api.post<AuthResponse>('/auth/verify-mfa', { mfaToken, code }),
  me: () => api.get<CustomerSummary>('/auth/me'),
  updateConsent: (active: boolean) => api.put<CustomerSummary>('/auth/consent', { active }),
}

export const dashboardApi = {
  getResilienceScore: () => api.get<ResilienceScore>('/dashboard/resilience-score'),
  getScoreHistory: () => api.get<ResilienceScore[]>('/dashboard/resilience-score/history'),
}

export interface DisconnectResult {
  institution: string
  accountType: string
  active: boolean
}

export interface DeleteResult {
  accountsRemoved: number
  transactionsRemoved: number
}

export const accountsApi = {
  getAll: () => api.get<Account[]>('/accounts'),
  getNetWorth: () => api.get<NetWorth>('/accounts/net-worth'),
  disconnect: (accountId: string) => api.post<DisconnectResult>(`/accounts/${accountId}/disconnect`),
  reconnect: (accountId: string) => api.post<DisconnectResult>(`/accounts/${accountId}/reconnect`),
}

export const consentApi = {
  deleteMyData: () => api.delete<DeleteResult>('/consent/my-data?confirm=DELETE'),
}

export const goalsApi = {
  getAll: () => api.get<Goal[]>('/goals'),
  create: (data: Partial<Goal>) => api.post<Goal>('/goals', data),
  update: (goalId: string, data: Partial<Goal>) => api.put<Goal>(`/goals/${goalId}`, data),
  pause: (goalId: string) => api.patch<Goal>(`/goals/${goalId}/pause`),
  resume: (goalId: string) => api.patch<Goal>(`/goals/${goalId}/resume`),
}

export const recommendationsApi = {
  getAll: () => api.get<Recommendation[]>('/recommendations'),
  getNextBestAction: () => api.get<Recommendation>('/recommendations/next-best-action'),
  respond: (id: string, response: 'APPROVED' | 'DISMISSED' | 'REMIND_LATER') =>
    api.patch<Recommendation>(`/recommendations/${id}`, { response }),
}

export const lifeEventsApi = {
  getAll: () => api.get<LifeEvent[]>('/events'),
  confirm: (eventId: string) => api.post<LifeEvent>(`/events/${eventId}/confirm`),
  reject: (eventId: string) => api.post<LifeEvent>(`/events/${eventId}/reject`),
}


export const openBankingApi = {
  getInstitutions: () => api.get<Institution[]>('/open-banking/institutions'),
  getInstitution: (id: string) => api.get<Institution>(`/open-banking/institutions/${id}`),
  link: (institutionId: string, selectedMasks: string[]) =>
    api.post<LinkResult>('/open-banking/link', { institutionId, selectedMasks }),
}

export default api
