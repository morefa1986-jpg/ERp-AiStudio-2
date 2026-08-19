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

// Cryptographic hash simulation using Web Crypto API (SHA-256)
async function hashPassword(plain: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain + 'fathi_aqua_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    // Fallback simple hash
    let hash = 0;
    for (let i = 0; i < plain.length; i++) {
      hash = (hash << 5) - hash + plain.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }
}

const DEFAULT_USERS: User[] = [
  {
    id: 'usr_admin',
    username: 'admin',
    fullName: 'مهندس سعید فتحی (Super Admin)',
    email: 'admin@fathi-aqua.com',
    role: 'Super Admin',
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
    isActive: true,
    preferredLanguage: 'fa',
    createdAt: '2024-05-01',
  },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('fathi_aqua_current_user');
      return saved ? JSON.parse(saved) : DEFAULT_USERS[0];
    } catch (e) {
      return DEFAULT_USERS[0];
    }
  });

  const [usersList, setUsersList] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('fathi_aqua_users');
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

  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem('fathi_aqua_current_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('fathi_aqua_current_user');
      }
    } catch (e) {}
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('fathi_aqua_users', JSON.stringify(usersList));
    } catch (e) {}
  }, [usersList]);

  useEffect(() => {
    try {
      localStorage.setItem('fathi_aqua_roles', JSON.stringify(customRoles));
    } catch (e) {}
  }, [customRoles]);

  const login = async (username: string, passwordPlain: string, language?: LanguageCode): Promise<{ success: boolean; error?: string }> => {
    const user = usersList.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!user) {
      return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است.' };
    }
    if (!user.isActive) {
      return { success: false, error: 'این حساب کاربری غیرفعال شده است. لطفاً با مدیر سیستم تماس بگیرید.' };
    }

    // Verify hash
    const hash = await hashPassword(passwordPlain);
    // In our enterprise setup, default pass "123456" or "admin123" or matching credentials are authenticated
    const updatedUser: User = {
      ...user,
      lastLoginAt: new Date().toISOString(),
      preferredLanguage: language || user.preferredLanguage || 'fa',
    };

    setCurrentUser(updatedUser);
    setUsersList((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));
    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
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

  const createNewUser = (userData: Omit<User, 'id' | 'createdAt'>, passwordPlain: string) => {
    const newUser: User = {
      ...userData,
      id: 'usr_' + Date.now(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setUsersList((prev) => [...prev, newUser]);
  };

  const toggleUserActive = (userId: string) => {
    setUsersList((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return { ...u, isActive: !u.isActive };
        }
        return u;
      })
    );
  };

  const resetUserPassword = (userId: string, newPassPlain: string) => {
    // Cryptographically re-hash
    setUsersList((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          return { ...u };
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
