import type { ScanRequest, ScanResult, ApiError } from '../types/scanner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const API_TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '30000', 10);

export interface AnalyzeResponse {
  url: string;
  verdict: string;
  risk_score: number;
  summary: string;
  lexical_analysis?: Array<{
    name: string;
    detected: boolean;
    description: string;
    severity?: string;
  }>;
  threat_intelligence?: {
    found: boolean;
    sources?: string[];
    details?: string;
  };
  page_inspection?: {
    suspicious_forms?: boolean;
    brand_impersonation?: boolean;
    suspicious_dom_patterns?: boolean;
    details?: string;
  };
  reasons?: string[];
  timestamp: string;
}

export interface PageInspectResponse {
  suspicious_forms?: boolean;
  brand_impersonation?: boolean;
  suspicious_dom_patterns?: boolean;
  details?: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'user' | 'org_admin' | 'super_admin';
  is_active: boolean;
  is_verified: boolean;
  is_provisioned?: boolean;
  deprovisioned_at?: string | null;
  auth_method?: string;
  last_login: string | null;
  created_at: string;
  extension_linked: boolean;
  extension_linked_at: string | null;
  memberships?: Array<{
    id: string;
    user_id: string;
    organization_id: string;
    role: 'member' | 'admin' | 'owner';
    joined_at: string;
    user?: User;
    organization?: Organization;
  }>;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: 'active' | 'inactive' | 'suspended';
  settings: Record<string, unknown>;
  sso_configured: boolean;
  sso_config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  plan_name?: string;
  plan_status?: string;
  max_users?: number;
  scans_per_month?: number;
  monthly_scan_limit?: number;
  license_expiry?: string | null;
  users_used?: number;
  users_remaining?: number;
  scans_used?: number;
  scans_remaining?: number;
}

export interface Scan {
  id: string;
  url: string;
  verdict: 'safe' | 'suspicious' | 'dangerous';
  risk_score: number;
  risk_color: string;
  phishing_probability: number;
  prediction: number;
  reasons: string[];
  stages?: Record<string, unknown>;
  page_inspect_result?: Record<string, unknown>;
  created_at: string;
  organization_id?: string;
  user_id?: string;
}

export interface Member {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'member' | 'admin' | 'owner';
  joined_at: string;
  user: User;
  organization: Organization;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

export interface PaginatedResponseWithOrganizations {
  organizations: Organization[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

export interface PaginatedResponseWithUsers {
  users: User[];
  data?: User[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
}

export interface SSOConfig {
  client_id: string;
  client_secret: string;
  tenant_id: string;
  enabled: boolean;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  type: string;
  description: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: User;
}

export interface RiskScoreBypassRule {
  id: string;
  scope: 'global' | 'organization' | 'group' | 'user';
  target_id: string | null;
  target_name?: string;
  organization_id: string | null;
  max_allowed_risk_score: number;
  description?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface UserGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
  user?: User;
}

export interface UserGroup {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  member_count: number;
  members?: UserGroupMember[];
}

class ApiService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private abortController: AbortController | null = null;

  constructor() {
    this.loadTokens();
  }

  private loadTokens() {
    try {
      this.accessToken = localStorage.getItem('access_token');
      this.refreshToken = localStorage.getItem('refresh_token');
    } catch {
      // Ignore localStorage errors
    }
  }

  saveTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    try {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
    } catch {
      // Ignore localStorage errors
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } catch {
      // Ignore localStorage errors
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth = false
  ): Promise<T> {
    const controller = new AbortController();
    this.abortController = controller;

    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (requireAuth && this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401 && requireAuth) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
          });
          if (retryResponse.ok) {
            return await retryResponse.json();
          }
        }
        this.clearTokens();
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error: ApiError = {
          message: errorData.message || errorData.error || `Request failed with status ${response.status}`,
          code: errorData.code,
          status: response.status,
        };
        throw error;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw { message: 'Request timed out', code: 'TIMEOUT' } as ApiError;
      }
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      this.saveTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // Auth endpoints
  async register(data: { email: string; password: string; first_name: string; last_name: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.saveTokens(response.access_token, response.refresh_token);
    return response;
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' }, true);
    this.clearTokens();
  }

  async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me', {}, true);
  }

  async updateProfile(data: { first_name?: string; last_name?: string }): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, true);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }, true);
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  }

  getMicrosoftSSOUrl(): string {
    return `${API_BASE_URL}/auth/sso/microsoft`;
  }

  // Extension endpoints
  async linkExtension(): Promise<{ extension_token: string; message: string }> {
    return this.request<{ extension_token: string; message: string }>('/auth/extension/link', {
      method: 'POST',
    }, true);
  }

  async unlinkExtension(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/extension/unlink', {
      method: 'POST',
    }, true);
  }

  async getExtensionStatus(): Promise<{ linked: boolean; linked_at: string | null }> {
    return this.request<{ linked: boolean; linked_at: string | null }>('/auth/extension/status', {}, true);
  }

  // Scanner endpoints
  async scanUrl(request: ScanRequest): Promise<ScanResult> {
    const [analyzeResponse, pageInspectResponse] = await Promise.allSettled([
      this.request<AnalyzeResponse>('/analyze', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
      this.request<PageInspectResponse>(`/page_inspect_result?url=${encodeURIComponent(request.url)}`),
    ]);

    const analyzeData = analyzeResponse.status === 'fulfilled' ? analyzeResponse.value : null;
    const pageInspectData = pageInspectResponse.status === 'fulfilled' ? pageInspectResponse.value : null;

    if (!analyzeData) {
      throw { message: 'Failed to analyze URL', code: 'ANALYZE_FAILED' } as ApiError;
    }

    return {
      url: analyzeData.url,
      verdict: this.mapVerdict(analyzeData.verdict),
      riskScore: analyzeData.risk_score,
      summary: analyzeData.summary,
      lexicalAnalysis: this.mapLexicalAnalysis(analyzeData.lexical_analysis),
      threatIntelligence: this.mapThreatIntelligence(analyzeData.threat_intelligence),
      pageInspection: this.mapPageInspection(pageInspectData || analyzeData.page_inspection),
      reasons: analyzeData.reasons,
      timestamp: analyzeData.timestamp,
    };
  }

  private mapVerdict(verdict: string): 'safe' | 'suspicious' | 'dangerous' {
    const normalized = verdict.toLowerCase();
    if (normalized === 'safe' || normalized === 'benign') return 'safe';
    if (normalized === 'suspicious' || normalized === 'warning') return 'suspicious';
    if (normalized === 'dangerous' || normalized === 'malicious' || normalized === 'phishing') return 'dangerous';
    return 'suspicious';
  }

  private mapLexicalAnalysis(analysis?: AnalyzeResponse['lexical_analysis']) {
    if (!analysis) return undefined;
    return analysis.map(item => ({
      name: item.name,
      detected: item.detected,
      description: item.description,
      severity: (item.severity as 'low' | 'medium' | 'high') || 'medium',
    }));
  }

  private mapThreatIntelligence(ti?: AnalyzeResponse['threat_intelligence']) {
    if (!ti) return undefined;
    return {
      found: ti.found,
      sources: ti.sources,
      details: ti.details,
    };
  }

  private mapPageInspection(pi?: PageInspectResponse | AnalyzeResponse['page_inspection']) {
    if (!pi) return undefined;
    return {
      suspiciousForms: pi.suspicious_forms,
      brandImpersonation: pi.brand_impersonation,
      suspiciousDomPatterns: pi.suspicious_dom_patterns,
      details: pi.details,
    };
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health');
  }

  // Scan endpoints
  async createScan(data: {
    url: string;
    verdict: 'safe' | 'suspicious' | 'dangerous';
    risk_score: number;
    risk_color: string;
    phishing_probability: number;
    prediction: number;
    reasons: string[];
    stages: Record<string, unknown>;
    page_inspect_result?: Record<string, unknown>;
    organization_id?: string;
  }): Promise<{ scan: Scan }> {
    return this.request<{ scan: Scan }>('/scans', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async listScans(params?: {
    page?: number;
    per_page?: number;
    verdict?: string;
    org_id?: string;
  }): Promise<PaginatedResponse<Scan>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.verdict) searchParams.set('verdict', params.verdict);
    if (params?.org_id) searchParams.set('org_id', params.org_id);

    const response = await this.request<{ scans: Scan[]; pagination: PaginatedResponse<Scan>['pagination'] }>(`/scans?${searchParams.toString()}`, {}, true);
    
    return {
      data: response.scans ?? [],
      pagination: response.pagination
    };
  }

  async getScan(scanId: string): Promise<{ scan: Scan }> {
    return this.request<{ scan: Scan }>(`/scans/${scanId}`, {}, true);
  }

  async deleteScan(scanId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/scans/${scanId}`, {
      method: 'DELETE',
    }, true);
  }

  async getScanStats(orgId?: string): Promise<{
    total: number;
    dangerous: number;
    suspicious: number;
    safe: number;
    recent: Scan[];
  }> {
    const searchParams = new URLSearchParams();
    if (orgId) searchParams.set('org_id', orgId);
    return this.request(`/scans/stats/summary?${searchParams.toString()}`, {}, true);
  }

  // Organization endpoints
  async listOrganizations(): Promise<{ organizations: Organization[] } | { organizations: Organization[]; pagination: PaginatedResponse<Organization>['pagination'] }> {
    return this.request('/organizations', {}, true);
  }

  async getOrganization(orgId: string): Promise<{ organization: Organization }> {
    return this.request<{ organization: Organization }>(`/organizations/${orgId}`, {}, true);
  }

  async createOrganization(data: { name: string; slug: string; domain?: string; admin_id?: string }): Promise<{ organization: Organization }> {
    return this.request<{ organization: Organization }>('/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async updateOrganization(orgId: string, data: { name?: string; domain?: string; status?: string; settings?: Record<string, unknown> }): Promise<{ organization: Organization }> {
    return this.request<{ organization: Organization }>(`/organizations/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, true);
  }

  async deleteOrganization(orgId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/organizations/${orgId}`, {
      method: 'DELETE',
    }, true);
  }

  async listMembers(orgId: string): Promise<{ members: Array<{
    id: string;
    user_id: string;
    organization_id: string;
    role: 'member' | 'admin' | 'owner';
    joined_at: string;
    user: User;
    organization: Organization;
  }> }> {
    return this.request(`/organizations/${orgId}/members`, {}, true);
  }

  async addMember(orgId: string, email: string, role: 'member' | 'admin' | 'owner' = 'member'): Promise<{ membership: {
    id: string;
    user_id: string;
    organization_id: string;
    role: 'member' | 'admin' | 'owner';
    joined_at: string;
    user: User;
    organization: Organization;
  } }> {
    return this.request(`/organizations/${orgId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }, true);
  }

  async updateMember(orgId: string, userId: string, role: 'member' | 'admin' | 'owner'): Promise<{ membership: {
    id: string;
    user_id: string;
    organization_id: string;
    role: 'member' | 'admin' | 'owner';
    joined_at: string;
    user: User;
    organization: Organization;
  } }> {
    return this.request(`/organizations/${orgId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }, true);
  }

  async removeMember(orgId: string, userId: string): Promise<{ message: string }> {
    return this.request(`/organizations/${orgId}/members/${userId}`, {
      method: 'DELETE',
    }, true);
  }

  async deprovisionMember(orgId: string, userId: string): Promise<{ message: string }> {
    return this.request(`/organizations/${orgId}/members/${userId}/deprovision`, {
      method: 'POST',
    }, true);
  }

  async getSettings(orgId: string): Promise<{ settings: Record<string, unknown> }> {
    return this.request(`/organizations/${orgId}/settings`, {}, true);
  }

  async updateSettings(orgId: string, settings: Record<string, unknown>): Promise<{ settings: Record<string, unknown> }> {
    return this.request(`/organizations/${orgId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    }, true);
  }

  async getSSOConfig(orgId: string): Promise<{ sso_config: SSOConfig; configured: boolean }> {
    return this.request(`/organizations/${orgId}/sso`, {}, true);
  }

  async configureSSO(orgId: string, data: { client_id: string; client_secret: string; tenant_id?: string; enabled?: boolean }): Promise<{ sso_config: SSOConfig; configured: boolean }> {
    return this.request(`/organizations/${orgId}/sso`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, true);
  }

  async disableSSO(orgId: string): Promise<{ message: string; configured: boolean }> {
    return this.request(`/organizations/${orgId}/sso`, {
      method: 'DELETE',
    }, true);
  }

  async getOrgActivity(orgId: string, params?: { page?: number; per_page?: number }): Promise<PaginatedResponse<ActivityLog>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    return this.request(`/organizations/${orgId}/activity?${searchParams.toString()}`, {}, true);
  }

  async getOrgStats(orgId: string): Promise<{
    scans: { total: number; dangerous: number; suspicious: number; safe: number };
    members: { total: number; admins: number };
    recent_scans: Scan[];
  }> {
    return this.request(`/organizations/${orgId}/stats`, {}, true);
  }

  // Admin endpoints (SUPER_ADMIN only)
  async getAdminDashboard(): Promise<{
    users: { total: number; active: number };
    organizations: { total: number; active: number };
    scans: { total: number; by_verdict: Record<string, number> };
    organizations_by_status: Record<string, number>;
    recent_users: User[];
    recent_organizations: Organization[];
    recent_scans: Scan[];
  }> {
    return this.request('/admin/dashboard', {}, true);
  }

  async adminListUsers(params?: { page?: number; per_page?: number; search?: string; role?: string; is_active?: string }): Promise<PaginatedResponseWithUsers> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.role) searchParams.set('role', params.role);
    if (params?.is_active) searchParams.set('is_active', params.is_active);
    return this.request(`/admin/users?${searchParams.toString()}`, {}, true);
  }

  async adminCreateUser(data: { email: string; password: string; first_name: string; last_name: string; role?: string; is_active?: boolean; is_verified?: boolean; organization_id?: string }): Promise<{ user: User }> {
    return this.request<{ user: User }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async adminUpdateUser(userId: string, data: { role?: string; is_active?: boolean; is_verified?: boolean; first_name?: string; last_name?: string }): Promise<{ user: User }> {
    return this.request<{ user: User }>(`/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, true);
  }

  async adminGetUser(userId: string): Promise<{ user: User }> {
    return this.request<{ user: User }>(`/admin/users/${userId}`, {}, true);
  }

  async superAdminGetAdmin(adminId: string): Promise<{ admin: User }> {
    return this.request<{ admin: User }>(`/super-admin/admins/${adminId}`, {}, true);
  }

  async adminDeleteUser(userId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/users/${userId}`, {
      method: 'DELETE',
    }, true);
  }

  async adminListOrganizations(params?: { page?: number; per_page?: number; search?: string; status?: string }): Promise<PaginatedResponseWithOrganizations> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    return this.request(`/admin/organizations?${searchParams.toString()}`, {}, true);
  }

  async adminCreateOrganization(data: { name: string; slug: string; domain?: string; admin_id?: string }): Promise<{ organization: Organization }> {
    return this.request<{ organization: Organization }>('/admin/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async adminUpdateOrganization(orgId: string, data: { name?: string; domain?: string; status?: string; settings?: Record<string, unknown> }): Promise<{ organization: Organization }> {
    return this.request<{ organization: Organization }>(`/admin/organizations/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, true);
  }

  async adminDeleteOrganization(orgId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/admin/organizations/${orgId}`, {
      method: 'DELETE',
    }, true);
  }

  async getAdminActivity(params?: { page?: number; per_page?: number; user_id?: string; org_id?: string; type?: string }): Promise<PaginatedResponse<ActivityLog>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.user_id) searchParams.set('user_id', params.user_id);
    if (params?.org_id) searchParams.set('org_id', params.org_id);
    if (params?.type) searchParams.set('type', params.type);
    return this.request(`/admin/activity?${searchParams.toString()}`, {}, true);
  }

  async getAdminStats(): Promise<{
    totals: { users: number; organizations: number; scans: number; memberships: number };
    users_by_role: Record<string, number>;
    organizations_by_status: Record<string, number>;
    scans_by_verdict: Record<string, number>;
  }> {
    return this.request('/admin/stats', {}, true);
  }

  // Organization Admin endpoints
  async getOrgAdminDashboard(): Promise<{
    organization: Organization;
    statistics: {
      total_users: number;
      active_users: number;
      provisioned_users: number;
      deprovisioned_users: number;
      sso_users: number;
      password_users: number;
      email_auth_users: number;
    };
    recent_activity: ActivityLog[];
  }> {
    return this.request('/org-admin/dashboard', {}, true);
  }

  async orgAdminListUsers(params?: { page?: number; per_page?: number; search?: string; status?: string; auth_method?: string }): Promise<PaginatedResponseWithUsers> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.auth_method) searchParams.set('auth_method', params.auth_method);
    return this.request(`/org-admin/users?${searchParams.toString()}`, {}, true);
  }

  async orgAdminGetUser(userId: string): Promise<{ user: User }> {
    return this.request(`/org-admin/users/${userId}`, {}, true);
  }

  async orgAdminCreateUser(data: { email: string; first_name: string; last_name: string; auth_method: string; password?: string }): Promise<{ user: User }> {
    return this.request<{ user: User }>('/org-admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async orgAdminUpdateUser(userId: string, data: { first_name?: string; last_name?: string; email?: string; is_active?: boolean; auth_method?: string }): Promise<{ user: User }> {
    return this.request<{ user: User }>(`/org-admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, true);
  }

  async orgAdminProvisionUser(userId: string): Promise<{ user: User }> {
    return this.request<{ user: User }>(`/org-admin/users/${userId}/provision`, { method: 'PATCH' }, true);
  }

  async orgAdminDeprovisionUser(userId: string): Promise<{ user: User }> {
    return this.request<{ user: User }>(`/org-admin/users/${userId}/deprovision`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    }, true);
  }

  async orgAdminReactivateUser(userId: string): Promise<{ user: User }> {
    return this.request<{ user: User }>(`/org-admin/users/${userId}/reactivate`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    }, true);
  }

  async orgAdminProvisioning(params?: { page?: number; per_page?: number; status?: string }): Promise<PaginatedResponse<User>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.status) searchParams.set('status', params.status);
    return this.request(`/org-admin/provisioning?${searchParams.toString()}`, {}, true);
  }

  async orgAdminBulkProvisioning(userIds: string[], action: 'provision' | 'deprovision'): Promise<{ message: string }> {
    return this.request('/org-admin/provisioning/bulk', {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds, action }),
    }, true);
  }

  async orgAdminGetAuthConfig(): Promise<{ auth_config: any }> {
    return this.request('/org-admin/auth-config', {}, true);
  }

  async orgAdminUpdateAuthConfig(data: {
    password_enabled: boolean;
    sso_enabled: boolean;
    email_auth_enabled: boolean;
    sso_provider?: string;
    sso_client_id?: string;
    sso_client_secret?: string;
    sso_tenant_id?: string;
    sso_issuer?: string;
    sso_redirect_url?: string;
    sso_domain?: string;
    sso_metadata_url?: string;
    email_auth_domain?: string;
  }): Promise<{ auth_config: any }> {
    return this.request('/org-admin/auth-config', {
      method: 'PUT',
      body: JSON.stringify(data),
    }, true);
  }

  async orgAdminActivity(params?: { page?: number; per_page?: number; search?: string; user_id?: string }): Promise<PaginatedResponse<ActivityLog>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.search) searchParams.set('search', params.search);
    if (params?.user_id) searchParams.set('user_id', params.user_id);
    return this.request(`/org-admin/activity?${searchParams.toString()}`, {}, true);
  }

  async orgAdminListInvitations(params?: { page?: number; per_page?: number }): Promise<PaginatedResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    return this.request(`/org-admin/invitations?${searchParams.toString()}`, {}, true);
  }

  async orgAdminInviteUser(data: { email: string; first_name: string; last_name: string }): Promise<{ message: string; invite_url: string; expires_at: string; invitation_id: string }> {
    return this.request<{ message: string; invite_url: string; expires_at: string; invitation_id: string }>('/org-admin/users/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async orgAdminResendInvitation(inviteId: string): Promise<{ invitation: any; invite_link: string }> {
    return this.request<{ invitation: any; invite_link: string }>(`/org-admin/invitations/${inviteId}/resend`, {
      method: 'POST',
    }, true);
  }

  async orgAdminCancelInvitation(inviteId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/org-admin/invitations/${inviteId}`, {
      method: 'DELETE',
    }, true);
  }

  async orgAdminGetLicense(): Promise<{
    license: {
      plan_name: string;
      plan_status: string;
      max_users: number;
      users_used: number;
      users_remaining: number;
      scans_per_month: number;
      scans_used: number;
      scans_remaining: number;
      license_expiry: string | null;
      is_expired: boolean;
    }
  }> {
    return this.request('/org-admin/license', {}, true);
  }

  async validateInviteToken(token: string): Promise<{
    email: string;
    first_name: string;
    last_name: string;
    organization_name: string;
    expires_at: string;
  }> {
    return this.request(`/auth/invite/${token}`, { method: 'GET' }, false);
  }

  async acceptInviteToken(token: string, data: { password?: string; first_name?: string; last_name?: string }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(`/auth/invite/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, false);
    if (response.access_token && response.refresh_token) {
      this.saveTokens(response.access_token, response.refresh_token);
    }
    return response;
  }

  // Risk Score Bypass Rules & User Groups endpoints
  async getBypassRules(orgId?: string): Promise<{ rules: RiskScoreBypassRule[] }> {
    const url = orgId ? `/bypass-rules?organization_id=${orgId}` : '/bypass-rules';
    return this.request<{ rules: RiskScoreBypassRule[] }>(url, {}, true);
  }

  async createBypassRule(data: {
    scope: 'global' | 'organization' | 'group' | 'user';
    max_allowed_risk_score: number;
    target_id?: string | null;
    organization_id?: string | null;
    description?: string;
  }): Promise<{ rule: RiskScoreBypassRule }> {
    return this.request<{ rule: RiskScoreBypassRule }>('/bypass-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async updateBypassRule(
    ruleId: string,
    data: { max_allowed_risk_score?: number; description?: string }
  ): Promise<{ rule: RiskScoreBypassRule }> {
    return this.request<{ rule: RiskScoreBypassRule }>(`/bypass-rules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, true);
  }

  async deleteBypassRule(ruleId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/bypass-rules/${ruleId}`, {
      method: 'DELETE',
    }, true);
  }

  async getUserGroups(orgId?: string): Promise<{ groups: UserGroup[] }> {
    const url = orgId ? `/user-groups?organization_id=${orgId}` : '/user-groups';
    return this.request<{ groups: UserGroup[] }>(url, {}, true);
  }

  async createUserGroup(data: {
    name: string;
    description?: string;
    organization_id?: string;
    user_ids?: string[];
  }): Promise<{ group: UserGroup }> {
    return this.request<{ group: UserGroup }>('/user-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }, true);
  }

  async deleteUserGroup(groupId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/user-groups/${groupId}`, {
      method: 'DELETE',
    }, true);
  }

  async updateGroupMember(groupId: string, userId: string, action: 'add' | 'remove'): Promise<{ group: UserGroup }> {
    return this.request<{ group: UserGroup }>(`/user-groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, action }),
    }, true);
  }
}

export const api = new ApiService();