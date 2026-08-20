import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import { Lock, User as UserIcon, Key, ShieldCheck, X, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isBlocking?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, isBlocking = false }) => {
  const { t, dir } = useI18n();
  const { currentUser, login, logout } = useAuth();
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  if (!isOpen && !isBlocking) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError(t('authModal.enterUsernamePassword'));
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (res.success) {
        setPassword('');
        onClose();
      } else {
        setError(res.error || t('authModal.invalidPassword'));
      }
    } catch (err) {
      setError(t('authModal.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  const setDemoAccount = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setError('');
  };

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn"
    >
      <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1F1F22] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#18181B] border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">{t('authModal.title')}</h3>
              <p className="text-[10px] text-[#71717A] uppercase tracking-wider font-mono">
                {t('authModal.subtitle')}
              </p>
            </div>
          </div>
          {!isBlocking && (
            <button
              onClick={onClose}
              className="p-1 text-[#71717A] hover:text-white rounded-lg hover:bg-[#18181B] cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-[#A1A1AA] font-medium mb-1.5 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{t('authModal.username')}:</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin, vet, hatchery, sales, accountant..."
              className="w-full bg-[#18181B] border border-[#27272A] rounded-xl p-3 text-white font-mono focus:border-[#D4AF37] focus:outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-[#A1A1AA] font-medium mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{t('authModal.password')}:</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl p-3 text-white font-mono focus:border-[#D4AF37] focus:outline-none transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A] hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Quick Demo Credentials */}
          <div className="bg-[#18181B]/80 border border-[#27272A] rounded-xl p-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wider">
              {t('authModal.demoAccounts')}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setDemoAccount('admin', 'admin123')}
                className="text-left px-2 py-1 bg-[#121214] hover:bg-[#27272A] text-[10px] font-mono text-[#E4E4E7] rounded border border-[#27272A] cursor-pointer flex justify-between"
              >
                <span>admin</span>
                <span className="text-[#71717A]">admin123</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount('vet', 'vet123')}
                className="text-left px-2 py-1 bg-[#121214] hover:bg-[#27272A] text-[10px] font-mono text-[#E4E4E7] rounded border border-[#27272A] cursor-pointer flex justify-between"
              >
                <span>vet</span>
                <span className="text-[#71717A]">vet123</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount('hatchery', 'hatchery123')}
                className="text-left px-2 py-1 bg-[#121214] hover:bg-[#27272A] text-[10px] font-mono text-[#E4E4E7] rounded border border-[#27272A] cursor-pointer flex justify-between"
              >
                <span>hatchery</span>
                <span className="text-[#71717A]">hatchery123</span>
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount('accountant', 'acc123')}
                className="text-left px-2 py-1 bg-[#121214] hover:bg-[#27272A] text-[10px] font-mono text-[#E4E4E7] rounded border border-[#27272A] cursor-pointer flex justify-between"
              >
                <span>accountant</span>
                <span className="text-[#71717A]">acc123</span>
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            {currentUser && !isBlocking ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="px-4 py-2 bg-[#18181B] hover:bg-[#1F1F22] text-rose-300 rounded-lg text-xs cursor-pointer border border-[#27272A]"
              >
                {t('authModal.logout')}
              </button>
            ) : (
              <span className="text-[10px] text-[#71717A]">{t('authModal.securityBadge')}</span>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 bg-[#D4AF37] hover:bg-[#c5a030] text-black font-semibold rounded-lg text-xs cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isLoading ? t('authModal.loggingIn') : t('authModal.login')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
