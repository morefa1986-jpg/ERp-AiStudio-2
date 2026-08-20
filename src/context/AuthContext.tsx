import React, { createContext, useContext, useEffect, useState } from 'react';
import { GranularPermission, LanguageCode, PermissionAction, PermissionModule, User } from '../types';
import { PASSWORD_SALT, hashPasswordWithSalt, verifyPasswordSecurely } from '../utils/authSecurity';
import { roleAllows } from '../utils/rbac';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, passwordPlain: string, language?: LanguageCode) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (module: PermissionModule, action: PermissionAction, scopeId?: string) => boolean;
  usersList: User[];
  createNewUser: (user: Omit<User, 'id' | 'createdAt'>, passwordPlain: string) => void;
  toggleUserActive: (userId: string) => void;
  resetUserPassword: (userId: string, newPassPlain: string) => void;
  customRoles: { id: string; name: string; permissions: GranularPermission[] }[];
  createCustomRole: (name: string, permissions: GranularPermission[]) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

type LocalUser = User & { passwordHash: string };

// Offline-only credential cache. Hashes match PASSWORD_SALT and contain no plaintext password.
const DEFAULT_USERS: LocalUser[] = [
  {
    id: 'usr_admin', username: 'admin', fullName: 'مهندس سعید فتحی (Super Admin)', email: 'admin@fathi-aqua.com',
    role: 'Super Admin', passwordHash: '6bda9e007f9f2b46bac9c60ed76969764f8b55d0f2d9955f8ba06a1c422700c6',
    isActive: true, preferredLanguage: 'fa', lastLoginAt: '2026-08-19T07:00:00Z', createdAt: '2024-01-01',
  },
  {
    id: 'usr_vet', username: 'vet', fullName: 'دکتر مریم علوی (سرپرست دامپزشکی و بهداشت)', email: 'vet@fathi-aqua.com',
    role: 'Veterinarian', passwordHash: '9fad5faa99c6ed98b343df7f9a142e7ee3699a1473baa0163a1836ec4244e46b',
    isActive: true, preferredLanguage: 'fa', createdAt: '2024-02-15',
  },
  {
    id: 'usr_hatchery', username: 'hatchery', fullName: 'مهندس رضا حسینی (مدیر تکثیر و ژنتیک)', email: 'hatchery@fathi-aqua.com',
    role: 'Hatchery Manager', passwordHash: '6b9e7b0dda7d0aba361da563aa59564986aa27a60466d857b9aeda89ce61283d',
    isActive: true, preferredLanguage: 'fa', createdAt: '2024-03-01',
  },
  {
    id: 'usr_sales', username: 'sales', fullName: 'آقای شمس (مدیر فروش و صادرات خاویار)', email: 'sales@fathi-aqua.com',
    role: 'Sales Manager', passwordHash: '365e4423b120eb78a6a162710903b03ac7fd7aecfe33db6c938954c9d80667ab',
    isActive: true, preferredLanguage: 'en', createdAt: '2024-04-10',
  },
  {
    id: 'usr_accountant', username: 'accountant', fullName: 'خانم مهندس صابری (حسابدار ارشد)', email: 'accounting@fathi-aqua.com',
    role: 'Accountant', passwordHash: '1ba376b43c9f34c8edfd83a03b57b7b35680919d870132bcf9c2baaaa2c12381',
    isActive: true, preferredLanguage: 'fa', createdAt: '2024-05-01',
  },
];

function sanitizeUser(user: LocalUser | (User & { passwordHash?: string })): User {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe as User;
}

function readLocalUsers(): LocalUser[] {
  try {
    const saved = localStorage.getItem('fathi_aqua_users_db');
    if (!saved) return DEFAULT_USERS;
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return DEFAULT_USERS;
    const valid = parsed.filter((user) => user && typeof user.username === 'string' && typeof user.passwordHash === 'string');
    return valid.length ? valid : DEFAULT_USERS;
  } catch {
    return DEFAULT_USERS;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [usersDb, setUsersDb] = useState<LocalUser[]>(readLocalUsers);
  const [customRoles, setCustomRoles] = useState<{ id: string; name: string; permissions: GranularPermission[] }[]>(() => {
    try {
      const saved = localStorage.getItem('fathi_aqua_roles');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const initSession = async () => {
      const token = localStorage.getItem('fathi_aqua_session_token');
      if (!token || token.startsWith('lan_session_')) {
        localStorage.removeItem('fathi_aqua_session_token');
        localStorage.removeItem('fathi_aqua_session_user');
        return;
      }

      try {
        const response = await fetch('/api/auth/session', { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('INVALID_SESSION');
        const data = await response.json();
        if (data.success && data.user?.id && data.user?.isActive) {
          setCurrentUser(data.user);
          setSessionToken(token);
          return;
        }
      } catch {
        // Fail closed. A cached user object is never accepted as an authenticated session.
      }

      localStorage.removeItem('fathi_aqua_session_token');
      localStorage.removeItem('fathi_aqua_session_user');
    };
    void initSession();
  }, []);

  useEffect(() => {
    try { localStorage.setItem('fathi_aqua_users_db', JSON.stringify(usersDb)); } catch {}
  }, [usersDb]);

  useEffect(() => {
    try { localStorage.setItem('fathi_aqua_roles', JSON.stringify(customRoles)); } catch {}
  }, [customRoles]);

  const login = async (username: string, passwordPlain: string, language?: LanguageCode): Promise<{ success: boolean; error?: string }> => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername || !passwordPlain) return { success: false, error: 'نام کاربری و رمز عبور الزامی است.' };

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalizedUsername, password: passwordPlain, language }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.user?.id || !data.token) {
        return { success: false, error: data.error || 'نام کاربری یا رمز عبور اشتباه است.' };
      }
      setCurrentUser(data.user);
      setSessionToken(data.token);
      localStorage.setItem('fathi_aqua_session_token', data.token);
      localStorage.setItem('fathi_aqua_session_user', JSON.stringify(data.user));
      return { success: true };
    } catch {
      // Offline mode validates the salted local hash. There are no plaintext/demo bypasses.
      const user = usersDb.find((item) => item.username.toLowerCase() === normalizedUsername);
      if (!user || !user.isActive) return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است.' };

      let valid = false;
      try {
        valid = await verifyPasswordSecurely(passwordPlain, PASSWORD_SALT, user.passwordHash);
      } catch {
        return { success: false, error: 'سرویس رمزنگاری محلی در دسترس نیست.' };
      }
      if (!valid) return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است.' };

      const updatedUser: User = {
        ...sanitizeUser(user),
        lastLoginAt: new Date().toISOString(),
        preferredLanguage: language || user.preferredLanguage || 'fa',
      };
      const localToken = `lan_session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      setCurrentUser(updatedUser);
      setSessionToken(localToken);
      // Offline sessions intentionally expire on application restart.
      return { success: true };
    }
  };

  const logout = () => {
    if (sessionToken && !sessionToken.startsWith('lan_session_')) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ token: sessionToken }),
      }).catch(() => {});
    }
    setCurrentUser(null);
    setSessionToken(null);
    localStorage.removeItem('fathi_aqua_session_token');
    localStorage.removeItem('fathi_aqua_session_user');
  };

  const hasPermission = (module: PermissionModule, action: PermissionAction, scopeId?: string): boolean => {
    if (!currentUser || !currentUser.isActive) return false;

    if (currentUser.customRoleId) {
      const customRole = customRoles.find((role) => role.id === currentUser.customRoleId);
      if (!customRole) return false;
      return customRole.permissions.some((permission) => {
        if (permission.module !== module || !permission.actions.includes(action)) return false;
        if (permission.scope === 'all') return true;
        return Boolean(scopeId && permission.scopeId === scopeId);
      });
    }

    if (!roleAllows(currentUser.role, module, action)) return false;
    if (!scopeId) return true;
    if (currentUser.pondScope?.length) return currentUser.pondScope.includes(scopeId);
    if (currentUser.hallScope?.length) return currentUser.hallScope.includes(scopeId);
    return true;
  };

  const usersList: User[] = usersDb.map(sanitizeUser);

  const createNewUser = async (userData: Omit<User, 'id' | 'createdAt'>, passwordPlain: string) => {
    if (passwordPlain.length < 8) throw new Error('PASSWORD_TOO_SHORT');
    if (usersDb.some((user) => user.username.toLowerCase() === userData.username.toLowerCase())) throw new Error('USERNAME_EXISTS');
    const passwordHash = await hashPasswordWithSalt(passwordPlain, PASSWORD_SALT);
    setUsersDb((previous) => [
      ...previous,
      { ...userData, passwordHash, id: `usr_${Date.now()}`, createdAt: new Date().toISOString().split('T')[0] },
    ]);
  };

  const toggleUserActive = (userId: string) => {
    setUsersDb((previous) => previous.map((user) => user.id === userId ? { ...user, isActive: !user.isActive } : user));
  };

  const resetUserPassword = async (userId: string, newPassPlain: string) => {
    if (newPassPlain.length < 8) throw new Error('PASSWORD_TOO_SHORT');
    const passwordHash = await hashPasswordWithSalt(newPassPlain, PASSWORD_SALT);
    setUsersDb((previous) => previous.map((user) => user.id === userId ? { ...user, passwordHash } : user));
  };

  const createCustomRole = (name: string, permissions: GranularPermission[]) => {
    if (!name.trim()) throw new Error('ROLE_NAME_REQUIRED');
    setCustomRoles((previous) => [...previous, { id: `role_${Date.now()}`, name: name.trim(), permissions }]);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        login,
        logout,
        hasPermission,
        usersList,
        createNewUser,
        toggleUserActive,
        resetUserPassword,
        customRoles,
        createCustomRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
