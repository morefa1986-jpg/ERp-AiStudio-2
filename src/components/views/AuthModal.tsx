import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, Key, CheckCircle2, ShieldCheck, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { usersList, currentUser, login, logout } = useAuth();
  const [selectedUsername, setSelectedUsername] = useState<string>(currentUser?.username || 'admin');
  const [password, setPassword] = useState<string>('admin123');
  const [error, setError] = useState<string>('');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await login(selectedUsername, password);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'کلمه عبور نادرست است.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#121214] border border-[#1F1F22] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#1F1F22] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#18181B] border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">ورود و مدیریت احراز هویت (RBAC)</h3>
              <p className="text-[10px] text-[#71717A] uppercase tracking-wider">Enterprise Security Authentication</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#71717A] hover:text-white rounded-lg hover:bg-[#18181B] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label className="block text-[#A1A1AA] font-medium mb-1.5">انتخاب کاربر / نقش پرسنلی:</label>
            <select
              value={selectedUsername}
              onChange={(e) => {
                setSelectedUsername(e.target.value);
                if (e.target.value === 'admin') setPassword('admin123');
                else if (e.target.value === 'dr_vet') setPassword('vet123');
                else if (e.target.value === 'feeding_tech') setPassword('feed123');
                else if (e.target.value === 'sales_mgr') setPassword('sales123');
                else if (e.target.value === 'financial_mgr') setPassword('acc123');
              }}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-xl p-3 text-white font-medium focus:border-[#D4AF37] focus:outline-none"
            >
              {usersList.map((u) => (
                <option key={u.id} value={u.username}>
                  {u.fullName} — {u.role} (@{u.username})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[#A1A1AA] font-medium mb-1.5">رمز عبور امنیتی:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#18181B] border border-[#27272A] rounded-xl p-3 text-white font-mono focus:border-[#D4AF37] focus:outline-none"
              required
            />
            <span className="text-[10px] text-[#52525B] font-mono block mt-1">
              Demo passwords: admin123 | vet123 | feed123 | sales123 | acc123
            </span>
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => {
                logout();
                onClose();
              }}
              className="px-4 py-2 bg-[#18181B] hover:bg-[#1F1F22] text-rose-300 rounded-lg text-xs cursor-pointer border border-[#27272A]"
            >
              خروج از حساب
            </button>

            <button
              type="submit"
              className="px-5 py-2 bg-[#D4AF37] hover:bg-[#c5a030] text-black font-semibold rounded-lg text-xs cursor-pointer shadow-sm"
            >
              ورود به سیستم
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
