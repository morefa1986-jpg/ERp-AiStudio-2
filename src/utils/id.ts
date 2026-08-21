let sequence = 0;

/** IDs are identifiers, not business measurements. Use a cryptographic UUID when available. */
export function nextId(prefix: string): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${(++sequence).toString(36)}`;
  return `${prefix}_${uuid}`;
}

export function nextReference(prefix: string): string {
  return `${prefix}-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${(++sequence).toString().padStart(4, '0')}`;
}
