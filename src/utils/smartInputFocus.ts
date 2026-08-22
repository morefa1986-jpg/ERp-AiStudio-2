export interface SmartEditableField {
  value: string;
  type?: string;
  tagName?: string;
  readOnly?: boolean;
  disabled?: boolean;
  getAttribute?: (name: string) => string | null;
  select?: () => void;
  dispatchEvent?: (event: Event) => boolean;
}

const BLOCKED_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'date',
  'datetime-local',
  'file',
  'hidden',
  'month',
  'password',
  'radio',
  'range',
  'reset',
  'submit',
  'time',
  'week',
]);

function attr(field: SmartEditableField, name: string): string | null {
  return field.getAttribute ? field.getAttribute(name) : null;
}

function normalizedZero(value: string): boolean {
  return /^[-+]?0+([.,]0+)?$/.test(value.trim());
}

export function isSmartEditableTarget(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (!target || typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLTextAreaElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;
  return !BLOCKED_INPUT_TYPES.has((target.type || 'text').toLowerCase());
}

export function shouldClearDefaultValue(field: SmartEditableField): boolean {
  if (field.disabled || field.readOnly) return false;
  const value = field.value.trim();
  if (!value) return false;
  if (attr(field, 'data-no-smart-focus') === 'true') return false;
  if (attr(field, 'data-auto-clear-default') === 'true') return true;

  const explicitDefault = attr(field, 'data-default-value');
  if (explicitDefault !== null && value === explicitDefault.trim()) return true;

  const type = (field.type || '').toLowerCase();
  if (type === 'number' && normalizedZero(value)) return true;

  return false;
}

export function prepareFieldForTyping(field: SmartEditableField): 'cleared' | 'selected' | 'ignored' {
  if (field.disabled || field.readOnly) return 'ignored';
  if (shouldClearDefaultValue(field)) {
    field.value = '';
    field.dispatchEvent?.(new Event('input', { bubbles: true }));
    field.dispatchEvent?.(new Event('change', { bubbles: true }));
    return 'cleared';
  }
  if (field.value && typeof field.select === 'function') {
    field.select();
    return 'selected';
  }
  return 'ignored';
}
