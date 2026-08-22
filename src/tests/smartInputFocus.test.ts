import { describe, expect, it, vi } from 'vitest';
import { prepareFieldForTyping, shouldClearDefaultValue, type SmartEditableField } from '../utils/smartInputFocus';

function field(overrides: Partial<SmartEditableField> & { attrs?: Record<string, string> }): SmartEditableField {
  const attrs = overrides.attrs || {};
  return {
    value: '',
    type: 'text',
    getAttribute: (name: string) => attrs[name] ?? null,
    select: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    ...overrides,
  };
}

describe('smart input focus behavior', () => {
  it('clears default numeric zero values on focus', () => {
    const input = field({ value: '0', type: 'number' });
    expect(shouldClearDefaultValue(input)).toBe(true);
    expect(prepareFieldForTyping(input)).toBe('cleared');
    expect(input.value).toBe('');
    expect(input.dispatchEvent).toHaveBeenCalled();
  });

  it('selects real non-default values instead of deleting them', () => {
    const input = field({ value: '125', type: 'number' });
    expect(prepareFieldForTyping(input)).toBe('selected');
    expect(input.value).toBe('125');
    expect(input.select).toHaveBeenCalled();
  });

  it('allows explicit default text fields to clear safely', () => {
    const input = field({ value: 'اپراتور پیش‌فرض', attrs: { 'data-default-value': 'اپراتور پیش‌فرض' } });
    expect(prepareFieldForTyping(input)).toBe('cleared');
    expect(input.value).toBe('');
  });
});
