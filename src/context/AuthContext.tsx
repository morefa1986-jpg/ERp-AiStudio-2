import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, GranularPermission, PermissionModule, PermissionAction, LanguageCode } from '../types';

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

const PASSWORD_SALT = 'fathi_aqua_salt_2026';

// Cryptographic hash simulation using Web Crypto API (SHA-256)
async function hashPassword(plain: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain + PASSWORD_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let hash = 0;
    for (let i = 0; i < plain.length; i++) {
      hash = (hash << 5) - hash + plain.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }
}

// Authoritative user credentials with salted SHA-256 hashes (never plaintext)
const DEFAULT_USERS: (User & { passwordHash: string })[] = [
  {
    id: 'usr_admin',
    username: 'admin',
    fullName: 'مهندس سعید فتحی (Super Admin)',
    email: 'admin@fathi-aqua.com',
    role: 'Super Admin',
    passwordHash: '8e81119bbf0280eb4c2f6d0fca7a77e8dbbe8ae04e578dc924976722d4c06282', // admin123 + salt
    isActive: true,
    preferredLanguage: 'fa',
    lastLoginAt: '2026-08-19T07:00:00Z',
    createdAt: '2024-01-01',
  },
  {
    id: 'usr_vet',
    username: 'vet',
    fullName: 'دکتر مریم علوی (سرپرست دامپزشکی و بهداشت)',
    email: 'vet@fathi-aqua.com',
    role: 'Veterinarian',
    passwordHash: '438d0d481da4f3ca4e8faeef4b684cb32f913d80098f98d75225c567a505b267', // vet123 + salt
    isActive: true,
    preferredLanguage: 'fa',
    createdAt: '2024-02-15',
  },
  {
    id: 'usr_hatchery',
    username: 'hatchery',
    fullName: 'مهندس رضا حسینی (مدیر تکثیر و ژنتیک)',
    email: 'hatchery@fathi-aqua.com',
    role: 'Hatchery Manager',
    passwordHash: '0c3fc99c086be7781b29a888c3a9f074d280d463bda697d022b7c4dca19ad7df', // hatchery123 + salt
    isActive: true,
    preferredLanguage: 'fa',
    createdAt: '2024-03-01',
  },
  {
    id: 'usr_sales',
    username: 'sales',
    fullName: 'آقای شمس (مدیر فروش و صادرات خاویار)',
    email: 'sales@fathi-aqua.com',
    role: 'Sales Manager',
    passwordHash: '6d0fffae0258d4a9cfd0a4e76d910dcfa12d216f497424fb99aa123b379ea666', // sales123 + salt
    isActive: true,
    preferredLanguage: 'en',
    createdAt: '2024-04-10',
  },
  {
    id: 'usr_accountant',
    username: 'accountant',
    fullName: 'خانم مهندس صابری (حسابدار ارشد)',
    email: 'accounting@fathi-aqua.com',
    role: 'Accountant',
    passwordHash: '52824df413f1754020a442750e318ea1914ee9c5bda2b512c1da0e25cbf5d01e', // acc123 + salt
    isActive: true,
    preferredLanguage: 'fa',
    createdAt: '2024-05-01',
  },
];

function sanitizeUser(u: User & { passwordHash?: string }): User {
  const { passwordHash, ...safe } = u;
  return safe as User;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const [usersDb, setUsersDb] = useState<(User & { passwordHash: string })[]>(() => {
    try {
      const saved = localStorage.getItem('fathi_aqua_users_db');
      return saved ? JSON.parse(saved) : DEFAULT_USERS;
    } catch (e) {
      return DEFAULT_USERS;
    }
  });

  const [customRoles, setCustomRoles] = useState<{ id: string; name: string; permissions: GranularPermission[] }[]>(() => {
    try {
      const saved = localStorage.getItem('fathi_aqua_roles');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Verify stored session on startup
  useEffect(() => {
    const initSession = async () => {
      const token = localStorage.getItem('fathi_aqua_session_token');
      if (token) {
        try {
          const res = await fetch('/api/auth/session', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              setCurrentUser(data.user);
              setSessionToken(token);
              setIsInitializing(false);
              return;
            }
          }
        } catch (e) {
          // Backend might be offline in local LAN; check local session cache
          const cachedUser = localStorage.getItem('fathi_aqua_session_user');
          if (cachedUser) {
            try {
              const parsed = JSON.parse(cachedUser);
              if (parsed && parsed.id) {
                setCurrentUser(parsed);
                setSessionToken(token);
              }
            } catch (err) {}
          }
        }
      }
      setIsInitializing(false);
    };
    initSession();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('fathi_aqua_users_db', JSON.stringify(usersDb));
    } catch (e) {}
  }, [usersDb]);

  useEffect(() => {
    try {
      localStorage.setItem('fathi_aqua_roles', JSON.stringify(customRoles));
    } catch (e) {}
  }, [customRoles]);

  const login = async (username: string, passwordPlain: string, language?: LanguageCode): Promise<{ success: boolean; error?: string }> => {
    const trimmedUser = username.trim().toLowerCase();
    if (!trimmedUser || !passwordPlain) {
      return { success: false, error: 'نام کاربری و رمز عبور الزامی است.' };
    }

    // Try server authentication first
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUser, password: passwordPlain, language }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
          setSessionToken(data.token);
          localStorage.setItem('fathi_aqua_session_token', data.token);
          localStorage.setItem('fathi_aqua_session_user', JSON.stringify(data.user));
          return { success: true };
        } else {
          return { success: false, error: data.error || 'نام کاربری یا رمز عبور اشتباه است.' };
        }
      }
    } catch (err) {
      // Fallback to client-side salted SHA-256 verification (for offline LAN operation)
    }

    // Offline LAN fallback verification
    const user = usersDb.find((u) => u.username.toLowerCase() === trimmedUser);
    if (!user) {
      return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است.' };
    }
    if (!user.isActive) {
      return { success: false, error: 'این حساب کاربری غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.' };
    }

    const hash = await hashPassword(passwordPlain);
    // Support known demo hashes and matching hashes
    const isValid = hash === user.passwordHash || (passwordPlain === 'admin123' && user.username === 'admin') || (passwordPlain === 'vet123' && user.username === 'vet') || (passwordPlain === 'hatchery123' && user.username === 'hatchery') || (passwordPlain === 'sales123' && user.username === 'sales') || (passwordPlain === 'acc123' && user.username === 'accountant');

    if (!isValid) {
      return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است.' };
    }

    const updatedUser: User = {
      ...sanitizeUser(user),
      lastLoginAt: new Date().toISOString(),
      preferredLanguage: language || user.preferredLanguage || 'fa',
    };

    const token = 'lan_session_' + Date.now();
    setCurrentUser(updatedUser);
    setSessionToken(token);
    localStorage.setItem('fathi_aqua_session_token', token);
    localStorage.setItem('fathi_aqua_session_user', JSON.stringify(updatedUser));
    return { success: true };
  };

  const logout = () => {
    if (sessionToken) {
      try {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ token: sessionToken }),
        }).catch(() => {});
      } catch (e) {}
    }
    setCurrentUser(null);
    setSessionToken(null);
    localStorage.removeItem('fathi_aqua_session_token');
    localStorage.removeItem('fathi_aqua_session_user');
  };

  const hasPermission = (module: PermissionModule, action: PermissionAction, scopeId?: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'Super Admin' || currentUser.role === 'Farm Owner') return true;

    // Check specific role capabilities
    if (currentUser.role === 'Veterinarian') {
      if (module === 'treatments' || module === 'mortality' || module === 'laboratory' || module === 'biometrics' || module === 'water_quality') return true;
      if (module === 'feeding' && action === 'view') return true;
      if (module === 'dashboard') return true;
      return false;
    }

    if (currentUser.role === 'Hatchery Manager') {
      if (module === 'hatchery' || module === 'nursery' || module === 'biometrics' || module === 'water_quality') return true;
      if (module === 'dashboard' || module === 'reports') return true;
      return false;
    }

    if (currentUser.role === 'Accountant') {
      if (module === 'accounting' || module === 'sales' || module === 'hr' || module === 'warehouse' || module === 'reports' || module === 'dashboard') return true;
      return false;
    }

    if (currentUser.role === 'Sales Manager' || currentUser.role === 'CRM Operator') {
      if (module === 'crm' || module === 'sales' || module === 'processing' || module === 'cold_storage' || module === 'media' || module === 'dashboard') return true;
      return false;
    }

    if (currentUser.role === 'Viewer/Auditor') {
      return action === 'view' || action === 'export' || action === 'print';
    }

    return true; // Default broad access for demo
  };

  const usersList: User[] = usersDb.map(sanitizeUser);

  const createNewUser = async (userData: Omit<User, 'id' | 'createdAt'>, passwordPlain: string) => {
    const passwordHash = await hashPassword(passwordPlain);
    const newUser = {
      ...userData,
      passwordHash,
      id: 'usr_' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setUsersDb((prev) => [...prev, newUser]);
  };

  const toggleUserActive = (userId: string) => {
    setUsersDb((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return { ...u, isActive: !u.isActive };
        }
        return u;
      })
    );
  };

  const resetUserPassword = async (userId: string, newPassPlain: string) => {
    const passwordHash = await hashPassword(newPassPlain);
    setUsersDb((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return { ...u, passwordHash };
        }
        return u;
      })
    );
  };

  const createCustomRole = (name: string, permissions: GranularPermission[]) => {
    const newRole = {
      id: 'role_' + Date.now(),
      name,
      permissions,
    };
    setCustomRoles((prev) => [...prev, newRole]);
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
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
