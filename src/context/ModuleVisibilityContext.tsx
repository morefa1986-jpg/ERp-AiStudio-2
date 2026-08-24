import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getStoredSessionToken, useAuth } from './AuthContext';
import {
  defaultModuleVisibility,
  normalizeModuleVisibility,
  SharedModuleVisibilityId,
  SharedModuleVisibilityMap,
} from '../utils/moduleVisibilityPolicy';

export type ModuleVisibilityId = SharedModuleVisibilityId;

export type ModuleSection = 'breeding' | 'hatchery' | 'commercial' | 'system';

export interface ModuleCatalogItem {
  id: ModuleVisibilityId;
  titleFa: string;
  titleEn: string;
  descriptionFa: string;
  section: ModuleSection;
  locked?: boolean;
}

export const MODULE_CATALOG: ModuleCatalogItem[] = [
  { id: 'dashboard', titleFa: 'داشبورد مدیریتی', titleEn: 'Dashboard', descriptionFa: 'نمای کلی KPI، هشدارها و وضعیت مجموعه', section: 'breeding', locked: true },
  { id: 'farmHalls', titleFa: 'سالن‌های پرورش', titleEn: 'Farm Halls', descriptionFa: 'ساختار سالن‌ها، ظرفیت و تجمیع استخرها', section: 'breeding' },
  { id: 'ponds', titleFa: 'استخرها و Digital Twin', titleEn: 'Ponds', descriptionFa: 'موجودی، بیومس، تله‌متری و عملیات سریع استخر', section: 'breeding' },
  { id: 'feeding', titleFa: 'مدیریت تغذیه', titleEn: 'Feeding', descriptionFa: 'جیره، ثبت خوراک و قفل‌های ایمنی', section: 'breeding' },
  { id: 'biometrics', titleFa: 'بیومتری و رشد', titleEn: 'Biometrics', descriptionFa: 'نمونه‌گیری وزن، SGR و یکنواختی گله', section: 'breeding' },
  { id: 'waterQuality', titleFa: 'کیفیت آب و سنسورها', titleEn: 'Water Quality', descriptionFa: 'DO، دما، pH، آمونیاک، نیتریت و سلامت داده', section: 'breeding' },
  { id: 'mortality', titleFa: 'تلفات', titleEn: 'Mortality', descriptionFa: 'ثبت، علت‌یابی و تاریخچه تلفات', section: 'breeding' },
  { id: 'treatments', titleFa: 'درمان و دارو', titleEn: 'Treatments', descriptionFa: 'درمان، دوز، Withdrawal و وضعیت درمان فعال', section: 'breeding' },
  { id: 'transfers', titleFa: 'انتقال ماهی', titleEn: 'Transfers', descriptionFa: 'جابجایی اتمیک ماهی و بیومس', section: 'breeding' },
  { id: 'hatchery', titleFa: 'تکثیر و مولدین', titleEn: 'Hatchery', descriptionFa: 'مولد، لقاح، انکوباتور، لارو و ردیابی', section: 'hatchery' },
  { id: 'nursery', titleFa: 'نرسری', titleEn: 'Nursery', descriptionFa: 'مخازن نرسری و بچ‌های لاروی', section: 'hatchery' },
  { id: 'feedFactory', titleFa: 'کارخانه خوراک', titleEn: 'Feed Factory', descriptionFa: 'مواد خوراکی و گردش تولید خوراک', section: 'hatchery' },
  { id: 'warehouse', titleFa: 'انبار', titleEn: 'Warehouse', descriptionFa: 'موجودی، ورود/خروج و نقطه سفارش', section: 'hatchery' },
  { id: 'laboratory', titleFa: 'آزمایشگاه', titleEn: 'Laboratory', descriptionFa: 'نمونه‌ها، نتایج و کنترل کیفی', section: 'hatchery' },
  { id: 'processing', titleFa: 'فرآوری', titleEn: 'Processing', descriptionFa: 'استحصال خاویار، گوشت و راندمان تولید', section: 'hatchery' },
  { id: 'coldStorage', titleFa: 'سردخانه', titleEn: 'Cold Storage', descriptionFa: 'لات‌ها، پالت‌ها، دما و موجودی محصول', section: 'hatchery' },
  { id: 'crm', titleFa: 'CRM مشتریان', titleEn: 'CRM', descriptionFa: 'پرونده مشتری و گردش ارتباطات تجاری', section: 'commercial' },
  { id: 'sales', titleFa: 'فروش و پیش‌فاکتور', titleEn: 'Sales', descriptionFa: 'پروفرما، سفارش، تحویل و فروش صادراتی', section: 'commercial' },
  { id: 'accounting', titleFa: 'حسابداری', titleEn: 'Accounting', descriptionFa: 'دفتر کل، اسناد دوبل و کدینگ حساب‌ها', section: 'commercial' },
  { id: 'hr', titleFa: 'منابع انسانی و حقوق', titleEn: 'HR & Payroll', descriptionFa: 'پرسنل، تردد و حقوق و دستمزد', section: 'commercial' },
  { id: 'aiAssistant', titleFa: 'دستیار هوشمند', titleEn: 'AI Assistant', descriptionFa: 'تحلیل داده و مشاور مزرعه', section: 'system' },
  { id: 'mediaStudio', titleFa: 'مرکز شبکه‌های اجتماعی', titleEn: 'Media Studio', descriptionFa: 'رسانه، کپشن، تأیید و انتشار کمکی', section: 'system' },
  { id: 'maintenance', titleFa: 'نگهداری و تعمیرات', titleEn: 'Maintenance', descriptionFa: 'تجهیزات، سرویس و نگهداری پیشگیرانه', section: 'system' },
  { id: 'reports', titleFa: 'گزارش‌ها', titleEn: 'Reports', descriptionFa: 'گزارش عملیاتی و خروجی داده', section: 'system' },
  { id: 'securityAudit', titleFa: 'امنیت و ممیزی', titleEn: 'Security & Audit', descriptionFa: 'کاربران، RBAC و ردپای عملیات', section: 'system' },
  { id: 'backup', titleFa: 'پشتیبان‌گیری', titleEn: 'Backup & Restore', descriptionFa: 'پشتیبان رمزنگاری‌شده و بازیابی', section: 'system' },
  { id: 'platformHub', titleFa: 'نسخه‌های اجرایی', titleEn: 'Platform Hub', descriptionFa: 'Windows، PWA و وضعیت بسته‌های اجرایی', section: 'system' },
  { id: 'adminSettings', titleFa: 'تنظیمات ادمین و کنترل ماژول‌ها', titleEn: 'Admin Settings', descriptionFa: 'مرکز کنترل کل ERP و روشن/خاموش کردن هر بخش', section: 'system', locked: true },
];

// Cache only. SQLite on the ERP server is the authoritative source.
export const MODULE_VISIBILITY_STORAGE_KEY = 'fathi_erp_module_visibility_v1';
type VisibilityMap = SharedModuleVisibilityMap;

function loadCache(): VisibilityMap {
  try {
    if (typeof window === 'undefined') return defaultModuleVisibility();
    const raw = window.localStorage.getItem(MODULE_VISIBILITY_STORAGE_KEY);
    return raw ? normalizeModuleVisibility(JSON.parse(raw)) : defaultModuleVisibility();
  } catch { return defaultModuleVisibility(); }
}

function cacheVisibility(visibility: VisibilityMap): void {
  try { if (typeof window !== 'undefined') window.localStorage.setItem(MODULE_VISIBILITY_STORAGE_KEY, JSON.stringify(visibility)); }
  catch { /* cache is optional */ }
}

interface ModuleVisibilityContextValue {
  visibility: VisibilityMap;
  canManageModules: boolean;
  isModuleEnabled: (id: string) => boolean;
  setModuleEnabled: (id: ModuleVisibilityId, enabled: boolean) => void;
  enableAllModules: () => void;
  disableOptionalModules: () => void;
  resetModuleVisibility: () => void;
  enabledCount: number;
  serverShared: boolean;
  syncing: boolean;
  lastError?: string;
}

const ModuleVisibilityContext = createContext<ModuleVisibilityContextValue | null>(null);

export const ModuleVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [visibility, setVisibility] = useState<VisibilityMap>(loadCache);
  const [serverShared, setServerShared] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string>();
  const canManageModules = currentUser?.role === 'Super Admin' || currentUser?.role === 'Farm Owner';

  const loadServerVisibility = async () => {
    const token = getStoredSessionToken();
    if (!token) return;
    setSyncing(true);
    try {
      const response = await fetch('/api/admin/module-visibility', { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || 'MODULE_VISIBILITY_LOAD_FAILED');
      const next = normalizeModuleVisibility(payload.visibility);
      setVisibility(next); cacheVisibility(next); setServerShared(true); setLastError(undefined);
    } catch (error) {
      setServerShared(false);
      setLastError(error instanceof Error ? error.message : 'MODULE_VISIBILITY_LOAD_FAILED');
    } finally { setSyncing(false); }
  };

  useEffect(() => {
    if (!currentUser) { setServerShared(false); return; }
    void loadServerVisibility();
  }, [currentUser?.id]);

  const persist = async (next: VisibilityMap, previous: VisibilityMap) => {
    const token = getStoredSessionToken();
    if (!token) { setVisibility(previous); setLastError('AUTH_REQUIRED'); return; }
    setSyncing(true);
    try {
      const response = await fetch('/api/admin/module-visibility', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: next }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || 'MODULE_VISIBILITY_SAVE_FAILED');
      const authoritative = normalizeModuleVisibility(payload.visibility);
      setVisibility(authoritative); cacheVisibility(authoritative); setServerShared(true); setLastError(undefined);
    } catch (error) {
      setVisibility(previous);
      setLastError(error instanceof Error ? error.message : 'MODULE_VISIBILITY_SAVE_FAILED');
      void loadServerVisibility();
    } finally { setSyncing(false); }
  };

  const commit = (next: VisibilityMap) => {
    if (!canManageModules || syncing) return;
    const previous = visibility;
    const normalized = normalizeModuleVisibility(next);
    setVisibility(normalized);
    void persist(normalized, previous);
  };

  const setModuleEnabled = (id: ModuleVisibilityId, enabled: boolean) => {
    if (!canManageModules) return;
    const item = MODULE_CATALOG.find((candidate) => candidate.id === id);
    if (!item || item.locked) return;
    commit({ ...visibility, [id]: enabled });
  };

  const enableAllModules = () => commit(defaultModuleVisibility());
  const disableOptionalModules = () => commit(Object.fromEntries(MODULE_CATALOG.map((item) => [item.id, Boolean(item.locked)])) as VisibilityMap);
  const resetModuleVisibility = () => commit(defaultModuleVisibility());

  const value = useMemo<ModuleVisibilityContextValue>(() => ({
    visibility,
    canManageModules,
    isModuleEnabled: (id: string) => {
      const item = MODULE_CATALOG.find((candidate) => candidate.id === id);
      if (!item) return true;
      return item.locked ? true : visibility[item.id] !== false;
    },
    setModuleEnabled,
    enableAllModules,
    disableOptionalModules,
    resetModuleVisibility,
    enabledCount: MODULE_CATALOG.filter((item) => item.locked || visibility[item.id] !== false).length,
    serverShared,
    syncing,
    lastError,
  }), [visibility, canManageModules, serverShared, syncing, lastError]);

  return <ModuleVisibilityContext.Provider value={value}>{children}</ModuleVisibilityContext.Provider>;
};

export function useModuleVisibility(): ModuleVisibilityContextValue {
  const context = useContext(ModuleVisibilityContext);
  if (!context) throw new Error('useModuleVisibility must be used within ModuleVisibilityProvider');
  return context;
}
