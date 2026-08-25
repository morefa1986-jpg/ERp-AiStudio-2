import { getStoredSessionToken } from '../context/AuthContext';
import { AttendanceRecord } from '../types';

function headers(): HeadersInit {
  const token = getStoredSessionToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function clockAttendanceServer(input: { employeeId: string; type: 'in' | 'out'; shift: AttendanceRecord['shift'] }): Promise<AttendanceRecord> {
  const response = await fetch('/api/hr/attendance/clock', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...input, timezoneOffsetMinutes: new Date().getTimezoneOffset() }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success || !payload.record) throw new Error(payload.error || 'ATTENDANCE_CLOCK_FAILED');
  return payload.record as AttendanceRecord;
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localMonthKey(date = new Date()): string {
  return localDateKey(date).slice(0, 7);
}
