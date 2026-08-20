import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, GranularPermission, PermissionModule, PermissionAction, LanguageCode } from '../types';
import { PASSWORD_SALT, hashPasswordWithSalt } from '../utils/authSecurity';

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

async function hashPassword(plain: string): Promise<string> {
  return hashPasswordWithSalt(plain, PASSWORD_SALT);
}

const DEFAULT_USERS: (User & { passwordHash: string })[] = [
  {
    id: 'usr_admin', username: 'admin', fullName: 'مهندس سعید فتحی (Super Admin)', email: 'admin@fathi-aqua.com',
    role: 'Super Admin', passwordHash: '8e81119bbf0280eb4c2f6d0fca7a77e8dbbe8ae04e578dc924976722d4c06282',
    isActive: true, preferredLanguage: 'fa', lastLoginAt: '2026-08-19T07:00:00Z', createdAt: '2024-01-01',
  },
  {
    id: 'usr_vet', username: 'vet', fullName: 'دکتر مریم علوی (سرپرست دامپزشکی و بهداشت)', email: 'vet@fathi-aqua.com',
    role: 'Veterinarian', passwordHash: '438d0d481da4f3ca4e8faeef4b684cb32f913d80098f98d75225c567a505b267',
    isActive: true, preferredLanguage: 'fa', createdAt: '2024-02-15',
  },
  {
    id: 'usr_hatchery', username: 'hatchery', fullName: 'مهندس رضا حسینی (مدیر تکثیر و ژنتیک)', email: 'hatchery@fathi-aqua.com',
    role: 'Hatchery Manager', passwordHash: '0c3fc99c086be7781b29a888c3a9f074d280d463bda697d022b7c4dca19ad7df',
    isActive: true, preferredLanguage: 'fa', createdAt: '2024-03-01',
  },
  {
    id: 'usr_sales', username: 'sales', fullName: 'آقای شمس (مدیر فروش و صادرات خاویار)', email: 'sales@fathi-aqua.com',
    role: 'Sales Manager', passwordHash: '6d0fffae0258d4a9cfd0a4e76d910dcfa12d216f497424fb99aa123b379ea666',
    isActive: true, preferredLanguage: 'en', createdAt: '2024-04-10',
  },
  {
    id: 'usr_accountant', username: 'accountant', fullName: 'خانم مهندس صابری (حسابدار ارشد)', email: 'accounting@fathi-aqua.com',
    role: 'Accountant', passwordHash: '52824df413f1754020a442750e318ea1914ee9c5bda2b512c1da0e25cbf5d01e',
    isActive: true, preferredLanguage: 'fa', createdAt: '2024-05-01',
  },
];

function sanitizeUser(u: User & { passwordHash?: string }): User {
  const { passwordHash: _passwordHash, ...safe } = u;
  return safe as User;
}

function roleAllows(role: string, module: PermissionModule, action: PermissionAction): boolean {
  if (role === 'Super Admin' || role === 'Farm Owner') return true;

  const viewLike = action === 'view' || action === 'export' || action === 'print';
  const operationalActions: PermissionAction[] = ['view', 'create', 'edit', 'approve', 'export', 'print'];
  const canOperate = operationalActions.includes(action);

  switch (role) {
    case 'Farm Manager':
      return module !== 'users' && module !== 'settings' ? action !== 'delete' : false;
    case 'Hall Manager':
      return ['dashboard', 'halls', 'ponds', 'feeding', 'biometrics', 'water_quality', 'mortality', 'treatments', 'transfers', 'reports'].includes(module) && canOperate;
    case 'Technician':
      return ['dashboard', 'ponds', 'feeding', 'biometrics', 'water_quality', 'mortality', 'treatments', 'transfers'].includes(module) && ['view', 'create', 'edit'].includes(action);
    case 'Veterinarian':
      return ['dashboard', 'treatments', 'mortality', 'laboratory', 'biometrics', 'water_quality', 'reports'].includes(module) && canOperate || (module === 'feeding' && viewLike);
    case 'Hatchery Manager':
      return ['dashboard', 'hatchery', 'nursery', 'biometrics', 'water_quality', 'laboratory', 'reports'].includes(module) && canOperate;
    case 'Laboratory':
      return ['dashboard', 'laboratory', 'water_quality', 'treatments', 'reports'].includes(module) && canOperate;
    case 'Feed Manager':
      return ['dashboard', 'feeding', 'feed_factory', 'warehouse', 'reports'].includes(module) && canOperate;
    case 'Warehouse Manager':
      return ['dashboard', 'warehouse', 'reports'].includes(module) && canOperate;
    case 'Processing Manager':
      return ['dashboard', 'processing', 'cold_storage', 'warehouse', 'reports'].includes(module) && canOperate;
    case 'Cold Storage Manager':
      return ['dashboard', 'cold_storage', 'warehouse', 'sales', 'reports'].includes(module) && canOperate;
    case 'Accountant':
      return ['dashboard', 'accounting', 'sales', 'hr', 'warehouse', 'reports'].includes(module) && canOperate;
    case 'Sales Manager':
    case 'CRM Operator':
      return ['dashboard', 'crm', 'sales', 'processing', 'cold_storage', 'media', 'reports'].includes(module) && canOperate;
    case 'HR Manager':
      return ['dashboard', 'hr', 'reports'].includes(module) && canOperate;
    case 'Media Manager':
      return ['dashboard', 'media', 'reports'].includes(module) && canOperate;
    case 'Viewer/Auditor':
      return viewLike;
    default:
      return false;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [usersDb, setUsersDb] = useState<(User & { passwordHash: string })[]>(() => {
    try {
      const saved = localStorage.getItem('fathi_aqua_users_db');
      return saved ? JSON.parse(saved) : DEFAULT_USERS;
    } catch {
      return DEFAULT_USERS;
    }
  });
  const [customRoles, setCustomRoles] = useState<{ id: string; name: string; permissions: GranularPermission[] }[]>(() => {
    try {
      const saved = localStorage.getItem('fathi_aqua_roles');
      return saved ? JSON.parse(saved) : [];
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
        const res = await fetch('/api/auth/session', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('INVALID_SESSION');
        const data = await res.json();
        if (data.success && data.user?.id) {
          setCurrentUser(data.user);
          setSessionToken(token);
          return;
        }
      } catch {
        // Fail closed: never restore an authenticated identity from an unverified local cache.
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
    const trimmedUser = username.trim().toLowerCase();
    if (!trimmedUser || !passwordPlain) return { success: false, error: 'نام کاربری و رمز عبور الزامی است.' };

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUser, password: passwordPlain, language }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.user || !data.token) {
        return { success: false, error: data.error || 'نام کاربری یا رمز عبور اشتباه است.' };
      }
      setCurrentUser(data.user);
      setSessionToken(data.token);
      localStorage.setItem('fathi_aqua_session_token', data.token);
      localStorage.setItem('fathi_aqua_session_user', JSON.stringify(data.user));
      return { success: true };
    } catch {
      // Explicit offline mode: verify the locally stored salted hash. No plaintext/demo bypasses are permitted.
      const user = usersDb.find((u) => u.username.toLowerCase() === trimmedUser);
      if (!user || !user.isActive) return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است.' };
      const hash = await hashPassword(passwordPlain);
      if (hash !== user.passwordHash) return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است.' };

      const updatedUser: User = {
        ...sanitizeUser(user),
        lastLoginAt: new Date().toISOString(),
        preferredLanguage: language || user.preferredLanguage || 'fa',
      };
      const token = `lan_session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      setCurrentUser(updatedUser);
      setSessionToken(token);
      // Offline sessions are deliberately not trusted across application restarts.
      return { success: true };
    }
  };

  const logout = () => {
    if (sessionToken && !sessionToken.startsWith('lan_session_')) {
      fetch('/api/auth/logout', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
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
      const customRole = customRoles.find((r) => r.id === currentUser.customRoleId);
      if (!customRole) return false;
      return customRole.permissions.some((p) => {
        if (p.module !== module || !p.actions.includes(action)) return false;
        if (p.scope === 'all') return true;
        if (!scopeId) return false;
        return p.scopeId === scopeId;
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
    const passwordHash = await hashPassword(passwordPlain);
    setUsersDb((prev) => [...prev, { ...userData, passwordHash, id: `usr_${Date.now()}`, createdAt: new Date().toISOString().split('T')[0] }]);
  };

  const toggleUserActive = (userId: string) => {
    setUsersDb((prev) => prev.map((u) => u.id === userId ? { ...u, isActive: !u.isActive } : u));
  };

  const resetUserPassword = async (userId: string, newPassPlain: string) => {
    if (newPassPlain.length < 8) throw new Error('PASSWORD_TOO_SHORT');
    const passwordHash = await hashPassword(newPassPlain);
    setUsersDb((prev) => prev.map((u) => u.id === userId ? { ...u, passwordHash } : u));
  };

  const createCustomRole = (name: string, permissions: GranularPermission[]) => {
    setCustomRoles((prev) => [...prev, { id: `role_${Date.now()}`, name, permissions }]);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: Boolean(currentUser), login, logout, hasPermission, usersList, createNewUser, toggleUserActive, resetUserPassword, customRoles, createCustomRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
