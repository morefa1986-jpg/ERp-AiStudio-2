import React, { useState } from 'react';
import { Clock, DollarSign, UserCheck } from 'lucide-react';
import { useI18n } from '../../i18n';
import { useFarm } from '../../context/FarmContext';
import { runtimeValueLabel } from '../../i18n/runtimeMessages';
import { AttendanceRecord } from '../../types';

export const HrPayrollView: React.FC = () => {
  const { t, formatNumber, formatCurrency, formatDate, formatTime, language } = useI18n();
  const { employees, attendance, payrolls, clockAttendance, generateMonthlyPayroll } = useFarm();
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'payroll'>('employees');
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');
  const [clockType, setClockType] = useState<'in' | 'out'>('in');
  const [shift, setShift] = useState<AttendanceRecord['shift']>('Morning (07:00 - 15:00)');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [notice, setNotice] = useState('');

  const submitClock = (event: React.FormEvent) => {
    event.preventDefault();
    const employee = employees.find((item) => item.id === selectedEmpId);
    if (!employee) return;
    clockAttendance(employee.id, clockType, shift);
    setNotice(t('hr.clockSuccess', { name: employee.fullName }));
  };

  const generate = () => {
    generateMonthlyPayroll(selectedMonth);
    setNotice(t('hr.payrollSuccess', { month: selectedMonth }));
    setActiveTab('payroll');
  };

  const shiftTime = (value: string) => value.match(/\((.*)\)/)?.[1] || value;

  return <div className="space-y-6 animate-fadeIn pb-12">
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4"><div><h1 className="text-xl font-black text-white flex items-center gap-2.5"><UserCheck className="w-6 h-6 text-amber-400" />{t('hr.title')}</h1><p className="text-xs text-slate-400 mt-1">{t('hr.subtitle')}</p></div><div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs"><Tab active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} label={`${t('hr.tabEmployees')} (${formatNumber(employees.length)})`} /><Tab active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} label={`${t('hr.tabAttendance')} (${formatNumber(attendance.length)})`} /><Tab active={activeTab === 'payroll'} onClick={() => setActiveTab('payroll')} label={`${t('hr.tabPayroll')} (${formatNumber(payrolls.length)})`} /></div></div>

    {notice && <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">{notice}</div>}

    {activeTab === 'employees' && <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto"><table className="w-full text-xs text-start"><thead className="bg-slate-800 text-slate-400"><tr><th className="p-3">{t('hr.thEmpName')}</th><th className="p-3">{t('hr.thDepartment')}</th><th className="p-3">{t('hr.thRole')}</th><th className="p-3">{t('hr.thNationalId')}</th><th className="p-3">{t('hr.thBaseSalary')}</th><th className="p-3">{t('hr.thHireDate')}</th><th className="p-3">{t('hr.thStatus')}</th></tr></thead><tbody className="divide-y divide-slate-800">{employees.map((employee) => <tr key={employee.id} className="text-slate-300"><td className="p-3 font-bold text-white">{employee.fullName}</td><td className="p-3">{employee.department}</td><td className="p-3">{employee.role}</td><td className="p-3 font-mono">{employee.nationalId}</td><td className="p-3 text-emerald-400">{formatCurrency(employee.baseSalary, employee.currency)}</td><td className="p-3">{formatDate(employee.hireDate)}</td><td className="p-3">{runtimeValueLabel(language, employee.status)}</td></tr>)}</tbody></table></div>}

    {activeTab === 'attendance' && <div className="grid grid-cols-1 lg:grid-cols-12 gap-6"><div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"><h3 className="font-bold text-sm text-white flex items-center gap-2"><Clock className="w-4 h-4 text-blue-400" />{t('hr.modalClockTitle')}</h3><form onSubmit={submitClock} className="space-y-3 text-xs"><label className="block text-slate-300">{t('hr.fieldEmp')}<select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)} className="mt-1 w-full field">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} — {employee.employeeCode}</option>)}</select></label><label className="block text-slate-300">{t('hr.fieldType')}<select value={clockType} onChange={(e) => setClockType(e.target.value as 'in' | 'out')} className="mt-1 w-full field"><option value="in">{t('hr.typeIn')}</option><option value="out">{t('hr.typeOut')}</option></select></label><label className="block text-slate-300">{t('hr.fieldShift')}<select value={shift} onChange={(e) => setShift(e.target.value as AttendanceRecord['shift'])} className="mt-1 w-full field"><option value="Morning (07:00 - 15:00)">07:00 - 15:00</option><option value="Evening (15:00 - 23:00)">15:00 - 23:00</option><option value="Night Watch (23:00 - 07:00)">23:00 - 07:00</option></select></label><button type="submit" className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-xl">{t('hr.btnClock')}</button></form></div><div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto"><table className="w-full text-xs text-start"><thead className="bg-slate-800 text-slate-400"><tr><th className="p-3">{t('hr.thEmpName')}</th><th className="p-3">{t('hr.thDate')}</th><th className="p-3">{t('hr.thClockIn')}</th><th className="p-3">{t('hr.thClockOut')}</th><th className="p-3">{t('hr.thShift')}</th><th className="p-3">{t('hr.thOvertime')}</th></tr></thead><tbody className="divide-y divide-slate-800">{attendance.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">{t('noData')}</td></tr> : attendance.map((row) => <tr key={row.id} className="text-slate-300"><td className="p-3 font-bold text-white">{row.employeeName}</td><td className="p-3">{formatDate(row.date)}</td><td className="p-3">{formatTime(row.clockInTime)}</td><td className="p-3">{row.clockOutTime ? formatTime(row.clockOutTime) : '—'}</td><td className="p-3">{shiftTime(row.shift)}</td><td className="p-3">{formatNumber(row.overtimeHours)}</td></tr>)}</tbody></table></div></div>}

    {activeTab === 'payroll' && <div className="space-y-4"><div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><label className="text-xs text-slate-300">{t('date')}<input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="ms-2 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5" /></label><button onClick={generate} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-2"><DollarSign className="w-4 h-4" />{t('hr.btnCalcPayroll')}</button></div><div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto"><table className="w-full text-xs text-start"><thead className="bg-slate-800 text-slate-400"><tr><th className="p-3">{t('hr.thEmpName')}</th><th className="p-3">{t('hr.thDepartment')}</th><th className="p-3">{t('hr.thBaseSalary')}</th><th className="p-3">{t('hr.thOvertime')}</th><th className="p-3">{t('hr.thTotalPay')}</th><th className="p-3">{t('hr.thApproved')}</th></tr></thead><tbody className="divide-y divide-slate-800">{payrolls.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-slate-500">{t('noData')}</td></tr> : payrolls.map((row) => <tr key={row.id} className="text-slate-300"><td className="p-3 font-bold text-white">{row.employeeName}</td><td className="p-3">{row.department}</td><td className="p-3">{formatCurrency(row.baseSalary, row.currency)}</td><td className="p-3">{formatCurrency(row.overtimePay, row.currency)}</td><td className="p-3 text-emerald-400 font-bold">{formatCurrency(row.netPay, row.currency)}</td><td className="p-3">{runtimeValueLabel(language, row.paymentStatus)}</td></tr>)}</tbody></table></div></div>}
    <style>{`.field{background:#1e293b;border:1px solid #334155;border-radius:.75rem;padding:.625rem;color:white}`}</style>
  </div>;
};

const Tab: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => <button onClick={onClick} className={`px-3 py-1.5 rounded-lg font-bold ${active ? 'bg-amber-500 text-slate-950' : 'text-slate-400'}`}>{label}</button>;
