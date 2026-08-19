import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import {
  UserCheck,
  Clock,
  DollarSign,
  Plus,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Employee, AttendanceRecord, PayrollRecord } from '../../types';

export const HrPayrollView: React.FC = () => {
  const { t, formatNumber, formatCurrency, formatDate } = useI18n();
  const {
    employees,
    attendance,
    payrolls,
    clockAttendance,
    generateMonthlyPayroll,
  } = useFarm();

  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'payroll'>('employees');
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '');
  const [clockType, setClockType] = useState<'in' | 'out'>('in');
  const [shift, setShift] = useState<AttendanceRecord['shift']>('Morning (07:00 - 15:00)');

  const [selectedMonth, setSelectedMonth] = useState<string>('1405-05 (مرداد)');

  const handleClockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((e) => e.id === selectedEmpId);
    if (!emp) return;

    clockAttendance(emp.id, clockType, shift);
    alert(`ثبت تردد ${emp.fullName} با موفقیت انجام شد.`);
  };

  const handleGeneratePayroll = () => {
    generateMonthlyPayroll(selectedMonth);
    alert(`محاسبه حقوق و دستمزد ماه ${selectedMonth} برای کلیه پرسنل با موفقیت انجام و اسناد صادر شد.`);
    setActiveTab('payroll');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5">
            <UserCheck className="w-6 h-6 text-amber-400" />
            منابع انسانی، ثبت تردد بیومتریک و محاسبه حقوق (HR & Payroll)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            پرونده پرسنلی، دستگاه حضور و غیاب اثر انگشت/تشخیص چهره، اضافه کار، بیمه و فیش‌های حقوقی ماهانه
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'employees'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            پرسنل و کادر ({employees.length})
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-blue-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ثبت تردد ({attendance.length})
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'payroll'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            فیش حقوق و دستمزد ({payrolls.length})
          </button>
        </div>
      </div>

      {/* TAB 1: Employees List */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <div
              key={emp.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-white">{emp.fullName}</h3>
                  <span className="text-xs text-amber-400 font-medium">{emp.role}</span>
                </div>
                <span className="font-mono text-xs text-slate-400 bg-slate-950 px-2 py-1 rounded">
                  {emp.employeeCode}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">بخش سازمانی:</span>
                  <strong className="text-white">{emp.department}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">نوع قرارداد:</span>
                  <strong className="text-slate-200">{emp.contractType}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">شماره تماس:</span>
                  <span className="font-mono">{emp.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">حقوق پایه ماهیانه:</span>
                  <strong className="text-emerald-400 font-mono">
                    {formatCurrency(emp.baseSalary)}
                  </strong>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">وضعیت استخدامی:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    emp.status === 'Active'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {emp.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: Attendance Clock In/Out */}
      {activeTab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              دستگاه ثبت تردد هوشمند
            </h3>

            <form onSubmit={handleClockSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">پرسنل:</label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.role} - {emp.employeeCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">نوع تردد:</label>
                  <select
                    value={clockType}
                    onChange={(e) => setClockType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white font-bold"
                  >
                    <option value="in">ورود (Clock In)</option>
                    <option value="out">خروج (Clock Out)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">شیفت کاری:</label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-white"
                  >
                    <option value="Morning (07:00 - 15:00)">شیفت صبح</option>
                    <option value="Evening (15:00 - 23:00)">شیفت عصر</option>
                    <option value="Night Watch (23:00 - 07:00)">شیفت شب</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 transition-all mt-2"
              >
                <Clock className="w-4 h-4" />
                ثبت تردد بیومتریک
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              لاگ ترددهای ثبت شده امروز
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right text-slate-300">
                <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase border-b border-slate-700">
                  <tr>
                    <th className="p-3">نام پرسنل</th>
                    <th className="p-3">تاریخ</th>
                    <th className="p-3">زمان ورود</th>
                    <th className="p-3">زمان خروج</th>
                    <th className="p-3">شیفت</th>
                    <th className="p-3">اضافه کار</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {attendance.map((att) => (
                    <tr key={att.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{att.employeeName}</td>
                      <td className="p-3 text-slate-400">{att.date}</td>
                      <td className="p-3 font-mono text-emerald-400">{att.clockInTime}</td>
                      <td className="p-3 font-mono text-amber-400">{att.clockOutTime || '---'}</td>
                      <td className="p-3 text-slate-300">{att.shift}</td>
                      <td className="p-3 font-mono text-slate-400">{att.overtimeHours} ساعت</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Monthly Payroll Records */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-300 font-bold">دوره محاسبه حقوق:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 text-xs font-semibold"
              >
                <option value="1405-05 (مرداد)">1405-05 (مرداد)</option>
                <option value="1405-04 (تیر)">1405-04 (تیر)</option>
                <option value="1405-03 (خرداد)">1405-03 (خرداد)</option>
              </select>
            </div>

            <button
              onClick={handleGeneratePayroll}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              <DollarSign className="w-4 h-4" />
              محاسبه و صدور سند حقوق ماه {selectedMonth}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {payrolls.map((pay) => (
              <div
                key={pay.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-white">{pay.employeeName}</h3>
                    <span className="text-xs text-slate-400">{pay.department} — {pay.payrollMonth}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {pay.paymentStatus}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">حقوق ناخالص:</span>
                    <span className="font-mono text-slate-300">{formatCurrency(pay.grossSalary)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">حق بیمه و مالیات:</span>
                    <span className="font-mono text-rose-400">
                      - {formatCurrency(pay.socialSecurityInsurance + pay.incomeTax)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">پاداش و سختی کار:</span>
                    <span className="font-mono text-emerald-400">+ {formatCurrency(pay.shiftBonus + pay.hardshipAllowance)}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                  <span className="font-bold text-white">خالص پرداختی:</span>
                  <strong className="font-black text-amber-400 text-sm font-mono">
                    {formatCurrency(pay.netPay)}
                  </strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
