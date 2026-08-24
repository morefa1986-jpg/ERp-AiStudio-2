import { describe, expect, it } from 'vitest';
import { buildAttendanceClockMutation, dateKeyForTimezoneOffset } from '../../server/hrAttendanceRoutes';

function baseState() {
  return {
    halls: [], ponds: [], species: [], feedingRecords: [], biometricSessions: [], waterLogs: [], mortalityRecords: [],
    treatments: [], transfers: [], broodstock: [], fertilizations: [], incubators: [], larvae: [], nurseryTanks: [],
    inventory: [], inventoryTxs: [], labSamples: [], processingBatches: [], coldStorage: [], customers: [], proformas: [],
    accounts: [], journals: [], employees: [{ id: 'emp_1', employeeCode: 'E1', fullName: 'Night Operator', status: 'Active' }],
    attendance: [], payrolls: [], equipment: [], socialPosts: [], auditLogs: [], backups: [],
  } as Record<string, unknown>;
}

describe('server authoritative HR attendance time handling', () => {
  it('derives the work date from the client timezone instead of UTC date', () => {
    const instant = new Date('2026-08-23T22:30:00.000Z').getTime();
    expect(dateKeyForTimezoneOffset(instant, -210)).toBe('2026-08-24');
    expect(dateKeyForTimezoneOffset(instant, 0)).toBe('2026-08-23');
  });

  it('closes a night shift after midnight while preserving the clock-in work date', () => {
    const clockInAt = new Date('2026-08-23T19:30:00.000Z').getTime(); // 23:00 at UTC+03:30
    const clockOutAt = new Date('2026-08-24T03:30:00.000Z').getTime(); // 07:00 at UTC+03:30
    const clockIn = buildAttendanceClockMutation(baseState(), {
      employeeId: 'emp_1', type: 'in', shift: 'Night Watch (23:00 - 07:00)', timezoneOffsetMinutes: -210,
    }, clockInAt);
    expect(clockIn.ok).toBe(true);
    expect(clockIn.record).toMatchObject({ date: '2026-08-23', regularHours: 0, overtimeHours: 0 });

    const clockOut = buildAttendanceClockMutation(clockIn.state!, {
      employeeId: 'emp_1', type: 'out', shift: 'Night Watch (23:00 - 07:00)', timezoneOffsetMinutes: -210,
    }, clockOutAt);
    expect(clockOut.ok).toBe(true);
    expect(clockOut.record).toMatchObject({ date: '2026-08-23', regularHours: 8, overtimeHours: 0 });
    expect((clockOut.state!.attendance as any[])[0].clockOutTime).toBe('2026-08-24T03:30:00.000Z');
  });

  it('rejects a second clock-in while an open shift exists and rejects impossible durations', () => {
    const clockInAt = new Date('2026-08-23T07:00:00.000Z').getTime();
    const first = buildAttendanceClockMutation(baseState(), {
      employeeId: 'emp_1', type: 'in', shift: 'Morning (07:00 - 15:00)', timezoneOffsetMinutes: -210,
    }, clockInAt);
    const duplicate = buildAttendanceClockMutation(first.state!, {
      employeeId: 'emp_1', type: 'in', shift: 'Morning (07:00 - 15:00)', timezoneOffsetMinutes: -210,
    }, clockInAt + 60_000);
    expect(duplicate.error).toBe('ATTENDANCE_OPEN_SHIFT_EXISTS');

    const tooLate = buildAttendanceClockMutation(first.state!, {
      employeeId: 'emp_1', type: 'out', shift: 'Morning (07:00 - 15:00)', timezoneOffsetMinutes: -210,
    }, clockInAt + 25 * 3_600_000);
    expect(tooLate.error).toBe('ATTENDANCE_DURATION_INVALID');
  });
});
