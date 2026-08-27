import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, type User } from '@services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; first_name: string; last_name: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  updateProfile: (data: { first_name?: string; last_name?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  hasRole: (roles: string | string[]) => boolean;
  isSuperAdmin: boolean;
  isOrgAdmin: boolean;
  isUser: boolean;
  primaryOrgId: string | null;
  primaryOrgRole: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;
  const isSuperAdmin = user?.role === 'super_admin';
  const isOrgAdmin = user?.role === 'org_admin';
  const isUser = user?.role === 'user';

  const primaryOrgId = user?.memberships?.[0]?.organization_id || null;
  const primaryOrgRole = user?.memberships?.[0]?.role || null;

  const hasRole = useCallback((roles: string | string[]) => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.getMe();
      setUser(response.user);
      return response.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    setUser(response.user);
  }, []);

  const register = useCallback(async (data: { email: string; password: string; first_name: string; last_name: string }) => {
    const response = await api.register(data);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: { first_name?: string; last_name?: string }) => {
    const response = await api.updateProfile(data);
    setUser(response.user);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.changePassword(currentPassword, newPassword);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      if (api.isAuthenticated()) {
        try {
          await refreshUser();
        } catch {
          api.clearTokens();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
      changePassword,
      hasRole,
      isSuperAdmin,
      isOrgAdmin,
      isUser,
      primaryOrgId,
      primaryOrgRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}