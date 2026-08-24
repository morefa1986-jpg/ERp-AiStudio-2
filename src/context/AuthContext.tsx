import React, { createContext, useContext, useEffect, useState } from 'react';
import { GranularPermission, LanguageCode, PermissionAction, PermissionModule, User } from '../types';
import { roleAllows } from '../utils/rbac';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, passwordPlain: string, language?: LanguageCode) => Promise<{ success: boolean; error?: string }>;
  bootstrapAdmin: (input: { username: string; password: string; fullName: string; email: string; language?: LanguageCode; setupToken?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (module: PermissionModule, action: PermissionAction, scopeId?: string) => boolean;
  usersList: User[];
  createNewUser: (user: Omit<User, 'id' | 'createdAt'>, passwordPlain: string) => Promise<void>;
  toggleUserActive: (userId: string) => Promise<void>;
  resetUserPassword: (userId: string, newPassPlain: string) => Promise<void>;
  customRoles: { id: string; name: string; permissions: GranularPermission[] }[];
  createCustomRole: (name: string, permissions: GranularPermission[]) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const SESSION_STORAGE_KEY = 'fathi_aqua_session_token';
const LAST_USER_STORAGE_KEY = 'fathi_aqua_last_user_id';

export function getStoredSessionToken(): string | null {
  try { return typeof window !== 'undefined' ? window.sessionStorage.getItem(SESSION_STORAGE_KEY) : null; } catch { return null; }
}

export function getLastAuthenticatedUserId(): string | null {
  try { return typeof window !== 'undefined' ? window.localStorage.getItem(LAST_USER_STORAGE_KEY) : null; } catch { return null; }
}

function setLastAuthenticatedUserId(userId: string): void {
  try {
    if (typeof window !== 'undefined' && userId.trim()) window.localStorage.setItem(LAST_USER_STORAGE_KEY, userId.trim());
  } catch { /* Non-secret identity hint is optional. */ }
}

function setStoredSessionToken(token: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (token) window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
    else window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch { /* Never create a client-side credential fallback. */ }
}

function sessionHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<User[]>([]);

  const refreshUsers = async (token: string) => {
    const response = await fetch('/api/auth/users', { headers: sessionHeaders(token) });
    if (!response.ok) return;
    const data = await response.json().catch(() => ({}));
    if (Array.isArray(data.users)) setUsersList(data.users);
  };

  useEffect(() => {
    const initSession = async () => {
      const token = getStoredSessionToken();
      if (!token) return;
      try {
        const response = await fetch('/api/auth/session', { headers: sessionHeaders(token) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success || !data.user?.id || !data.user?.isActive) throw new Error('INVALID_SESSION');
        setLastAuthenticatedUserId(String(data.user.id));
        setCurrentUser(data.user);
        setSessionToken(token);
        if (data.user.role === 'Super Admin' || data.user.role === 'Farm Owner') await refreshUsers(token);
      } catch {
        setStoredSessionToken(null);
        setCurrentUser(null);
        setSessionToken(null);
      }
    };
    void initSession();
  }, []);

  const login = async (username: string, passwordPlain: string, language?: LanguageCode) => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername || !passwordPlain) return { success: false, error: 'USERNAME_PASSWORD_REQUIRED' };
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: normalizedUsername, password: passwordPlain, language }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.user?.id || !data.token) return { success: false, error: data.error || 'INVALID_CREDENTIALS' };
      if (data.user.customRoleId) return { success: false, error: 'SERVER_CUSTOM_ROLE_NOT_SUPPORTED' };
      setLastAuthenticatedUserId(String(data.user.id));
      setStoredSessionToken(data.token); setCurrentUser(data.user); setSessionToken(data.token);
      if (data.user.role === 'Super Admin' || data.user.role === 'Farm Owner') await refreshUsers(data.token);
      return { success: true };
    } catch { return { success: false, error: 'AUTH_SERVER_UNAVAILABLE' }; }
  };

  const bootstrapAdmin = async (input: { username: string; password: string; fullName: string; email: string; language?: LanguageCode; setupToken?: string }) => {
    try {
      const { setupToken, ...body } = input;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (setupToken?.trim()) headers['x-fathi-setup-token'] = setupToken.trim();
      const response = await fetch('/api/auth/bootstrap', { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) return { success: false, error: data.error || 'BOOTSTRAP_FAILED' };
      return login(input.username, input.password, input.language);
    } catch { return { success: false, error: 'AUTH_SERVER_UNAVAILABLE' }; }
  };

  const logout = () => {
    const token = sessionToken;
    if (token) fetch('/api/auth/logout', { method: 'POST', headers: sessionHeaders(token) }).catch(() => {});
    setCurrentUser(null); setSessionToken(null); setUsersList([]); setStoredSessionToken(null);
    // Intentionally keep LAST_USER_STORAGE_KEY so an unsynced durable outbox remains owned by the correct account after restart/login.
  };

  const hasPermission = (module: PermissionModule, action: PermissionAction, scopeId?: string): boolean => {
    if (!currentUser || !currentUser.isActive || currentUser.customRoleId) return false;
    if (!roleAllows(currentUser.role, module, action)) return false;
    if (!scopeId) return true;
    if (currentUser.pondScope?.length) return currentUser.pondScope.includes(scopeId);
    if (currentUser.hallScope?.length) return currentUser.hallScope.includes(scopeId);
    return true;
  };

  const requireToken = () => sessionToken || getStoredSessionToken() || '';
  const createNewUser = async (userData: Omit<User, 'id' | 'createdAt'>, passwordPlain: string) => {
    if (passwordPlain.length < 12) throw new Error('PASSWORD_TOO_SHORT');
    if (userData.customRoleId) throw new Error('SERVER_CUSTOM_ROLE_NOT_SUPPORTED');
    const token = requireToken();
    const response = await fetch('/api/auth/users', { method: 'POST', headers: sessionHeaders(token), body: JSON.stringify({ ...userData, password: passwordPlain }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'USER_CREATE_FAILED');
    await refreshUsers(token);
  };

  const updateUser = async (userId: string, patch: Record<string, unknown>) => {
    const token = requireToken();
    const response = await fetch(`/api/auth/users/${encodeURIComponent(userId)}`, { method: 'PATCH', headers: sessionHeaders(token), body: JSON.stringify(patch) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'USER_UPDATE_FAILED');
    await refreshUsers(token);
  };

  const toggleUserActive = (userId: string) => updateUser(userId, { isActive: !usersList.find((user) => user.id === userId)?.isActive });
  const resetUserPassword = (userId: string, newPassPlain: string) => {
    if (newPassPlain.length < 12) return Promise.reject(new Error('PASSWORD_TOO_SHORT'));
    return updateUser(userId, { password: newPassPlain });
  };

  // Client-only custom roles were misleading and could not be enforced by the server.
  // Keep the API fail-closed until custom roles are persisted and authorized server-side.
  const customRoles: { id: string; name: string; permissions: GranularPermission[] }[] = [];
  const createCustomRole = (_name: string, _permissions: GranularPermission[]) => { throw new Error('SERVER_CUSTOM_ROLE_NOT_SUPPORTED'); };

  return <AuthContext.Provider value={{ currentUser, isAuthenticated: Boolean(currentUser), login, bootstrapAdmin, logout, hasPermission, usersList, createNewUser, toggleUserActive, resetUserPassword, customRoles, createCustomRole }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
