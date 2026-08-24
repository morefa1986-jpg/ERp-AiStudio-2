import React, { useMemo, useState } from 'react';
import { Calendar, Clock, DollarSign, UserCheck } from 'lucide-react';
import { useFarm } from '../../context/FarmContext';
import { useI18n } from '../../i18n';
import { clockAttendanceServer, localDateKey, localMonthKey } from '../../services/hrAttendanceService';
import { AttendanceRecord } from '../../types';

export const HrPayrollView: React.FC = () => {
  const { formatCurrency, formatDate, formatTime } = useI18n();
  const { employees, attendance, payrolls, generateMonthlyPayroll } = useFarm();
  const [tab, setTab] = useState<'employees' | 'attendance' | 'payroll'>('employees');
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');
  const [clockType, setClockType] = useState<'in' | 'out'>('in');
  const [shift, setShift] = useState<AttendanceRecord['shift']>('Morning (07:00 - 15:00)');
  const [selectedMonth, setSelectedMonth] = useState(localMonthKey());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const today = localDateKey();
  const todayAttendance = useMemo(() => attendance.filter((row) => row.date === today || (!row.clockOutTime && localDateKey(new Date(row.clockInTime)) === today)), [attendance, today]);

  const submitAttendance = async (event: React.FormEvent) => {
    event.preventDefault();
    const employee = employees.find((item) => item.id === selectedEmpId);
    if (!employee) { setMessage('پرسنل انتخاب‌شده یافت نشد.'); return; }
    setBusy(true); setMessage('');
    try {
      await clockAttendanceServer({ employeeId: employee.id, type: clockType, shift });
      setMessage(`تردد ${employee.fullName} روی Server ثبت شد. تاریخ از timezone همین دستگاه محاسبه شده و خروج شیفت شب می‌تواند رکورد باز روز قبل را ببندد.`);
      window.location.reload();
    } catch (error) {
      setMessage(`ثبت تردد انجام نشد: ${error instanceof Error ? error.message : 'ATTENDANCE_CLOCK_FAILED'}`);
      setBusy(false);
    }
  };

  const runPayroll = () => {
    if (!/^\d{4}-\d{2}$/.test(selectedMonth)) { setMessage('دوره حقوق باید با قالب YYYY-MM باشد.'); return; }
    generateMonthlyPayroll(selectedMonth);
    setMessage(`محاسبه پیش‌نویس حقوق دوره ${selectedMonth} اجرا شد. نرخ بیمه/مالیات فقط زمانی باید اعمال شود که در موتور حقوق پیکربندی قانونی معتبر داشته باشد.`);
    setTab('payroll');
  };

  return <div className="space-y-6 pb-12 animate-fadeIn">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div><h1 className="text-xl font-black text-white flex items-center gap-2"><UserCheck className="w-6 h-6 text-amber-400" />منابع انسانی، تردد و حقوق</h1><p className="text-xs text-slate-400 mt-1">تردد نرم‌افزاری اکنون Server-authoritative است و تاریخ کاری بر اساس timezone دستگاه ثبت‌کننده محاسبه می‌شود. اتصال واقعی دستگاه بیومتریک همچنان نیازمند Driver/API سخت‌افزار است.</p></div>
      <div className="flex flex-wrap gap-2 text-xs"><button onClick={() => setTab('employees')} className={`px-3 py-2 rounded-xl ${tab === 'employees' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>پرسنل ({employees.length})</button><button onClick={() => setTab('attendance')} className={`px-3 py-2 rounded-xl ${tab === 'attendance' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>تردد ({attendance.length})</button><button onClick={() => setTab('payroll')} className={`px-3 py-2 rounded-xl ${tab === 'payroll' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'}`}>حقوق ({payrolls.length})</button></div>
    </div>

    {message && <div className="bg-blue-500/10 border border-blue-500/30 text-blue-200 rounded-xl p-3 text-xs">{message}</div>}

    {tab === 'employees' && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{employees.map((employee) => <div key={employee.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-xs"><div className="flex justify-between gap-2 border-b border-slate-800 pb-3"><div><strong className="text-white block">{employee.fullName}</strong><span className="text-amber-400">{employee.role}</span></div><span className="font-mono text-slate-500">{employee.employeeCode}</span></div><div className="space-y-2 mt-3 text-slate-400"><div className="flex justify-between"><span>بخش</span><strong className="text-slate-200">{employee.department}</strong></div><div className="flex justify-between"><span>قرارداد</span><strong className="text-slate-200">{employee.contractType}</strong></div><div className="flex justify-between"><span>حقوق پایه</span><strong className="text-emerald-400">{formatCurrency(employee.baseSalary, employee.currency)}</strong></div><div className="flex justify-between"><span>وضعیت</span><strong className={employee.status === 'Active' ? 'text-emerald-400' : 'text-amber-400'}>{employee.status}</strong></div></div></div>)}</div>}

    {tab === 'attendance' && <div className="grid lg:grid-cols-12 gap-5"><div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5"><h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-blue-400" />ثبت تردد نرم‌افزاری</h2><form onSubmit={submitAttendance} className="space-y-3 text-xs"><select value={selectedEmpId} onChange={(event) => setSelectedEmpId(event.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} — {employee.employeeCode}</option>)}</select><div className="grid grid-cols-2 gap-2"><select value={clockType} onChange={(event) => setClockType(event.target.value as 'in' | 'out')} className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option value="in">ورود</option><option value="out">خروج</option></select><select value={shift} onChange={(event) => setShift(event.target.value as AttendanceRecord['shift'])} className="bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"><option value="Morning (07:00 - 15:00)">صبح 07–15</option><option value="Evening (15:00 - 23:00)">عصر 15–23</option><option value="Night Watch (23:00 - 07:00)">شب 23–07</option></select></div><button disabled={busy} type="submit" className="w-full bg-blue-600 disabled:opacity-50 text-white rounded-xl py-2.5 font-bold">ثبت تردد روی Server</button></form><div className="mt-3 text-[10px] text-slate-500">تاریخ کاری امروز: <span className="font-mono text-slate-300">{today}</span> · timezone offset: <span className="font-mono text-slate-300">{new Date().getTimezoneOffset()} min</span></div></div><div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5"><h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><Calendar className="w-4 h-4 text-blue-400" />تردد امروز</h2><div className="overflow-x-auto"><table className="w-full text-xs text-right"><thead className="text-slate-500 bg-slate-950"><tr><th className="p-3">پرسنل</th><th className="p-3">روز کاری</th><th className="p-3">ورود</th><th className="p-3">خروج</th><th className="p-3">ساعت عادی</th><th className="p-3">اضافه‌کار</th></tr></thead><tbody className="divide-y divide-slate-800">{todayAttendance.map((row) => <tr key={row.id} className="text-slate-300"><td className="p-3 text-white font-bold">{row.employeeName}</td><td className="p-3 font-mono">{row.date}</td><td className="p-3 font-mono text-emerald-400">{formatDate(row.clockInTime)} {formatTime(row.clockInTime)}</td><td className="p-3 font-mono text-amber-400">{row.clockOutTime ? `${formatDate(row.clockOutTime)} ${formatTime(row.clockOutTime)}` : '—'}</td><td className="p-3">{row.regularHours}</td><td className="p-3">{row.overtimeHours}</td></tr>)}</tbody></table></div></div></div>}

    {tab === 'payroll' && <div className="space-y-4"><div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"><label className="text-xs text-slate-300">دوره حقوق (Gregorian YYYY-MM)<input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="block mt-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white" /></label><button onClick={runPayroll} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2"><DollarSign className="w-4 h-4" />محاسبه پیش‌نویس حقوق</button></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{payrolls.map((pay) => <div key={pay.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-xs"><div className="flex justify-between border-b border-slate-800 pb-3"><div><strong className="text-white block">{pay.employeeName}</strong><span className="text-slate-500">{pay.payrollMonth}</span></div><span className="text-emerald-400 font-bold">{pay.paymentStatus}</span></div><div className="space-y-2 mt-3"><div className="flex justify-between text-slate-400"><span>حقوق پایه</span><span>{formatCurrency(pay.baseSalary, pay.currency)}</span></div><div className="flex justify-between text-slate-400"><span>اضافه‌کار</span><span className="text-emerald-400">+ {formatCurrency(pay.overtimePay, pay.currency)}</span></div><div className="flex justify-between text-slate-400"><span>بیمه + مالیات</span><span className="text-rose-400">- {formatCurrency(pay.socialSecurityInsurance + pay.incomeTax, pay.currency)}</span></div><div className="flex justify-between border-t border-slate-800 pt-2"><strong className="text-white">خالص</strong><strong className="text-amber-400">{formatCurrency(pay.netPay, pay.currency)}</strong></div></div></div>)}</div></div>}
  </div>;
};
