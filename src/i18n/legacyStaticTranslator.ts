import type { LanguageCode } from '../types';

type Dictionary = Record<string, unknown>;

const TEXT_SOURCE = new WeakMap<Text, string>();
const ATTR_SOURCE = new WeakMap<Element, Map<string, string>>();
const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE']);
const PERSIAN_ARABIC_RE = /[\u0600-\u06FF]/;

function flattenPairs(source: unknown, target: unknown, pairs: Array<[string, string]>): void {
  if (typeof source === 'string' && typeof target === 'string') {
    const from = source.trim();
    const to = target.trim();
    if (from && to && from !== to && PERSIAN_ARABIC_RE.test(from)) pairs.push([from, to]);
    return;
  }
  if (!source || !target || typeof source !== 'object' || typeof target !== 'object') return;
  for (const key of Object.keys(source as Dictionary)) {
    flattenPairs((source as Dictionary)[key], (target as Dictionary)[key], pairs);
  }
}

export function buildLegacyStaticTranslationMap(sourceFa: Dictionary, target: Dictionary): Map<string, string> {
  const pairs: Array<[string, string]> = [];
  flattenPairs(sourceFa, target, pairs);
  pairs.sort((a, b) => b[0].length - a[0].length);
  return new Map(pairs);
}

export function translateLegacyStaticText(source: string, translations: Map<string, string>, language: LanguageCode): string {
  if (language === 'fa' || !source || !PERSIAN_ARABIC_RE.test(source)) return source;
  let translated = source;
  for (const [from, to] of translations) {
    if (translated.includes(from)) translated = translated.split(from).join(to);
  }
  return translated;
}

function isSkipped(node: Node): boolean {
  const parent = node.parentElement;
  return !parent || SKIP_TAGS.has(parent.tagName) || parent.closest('[data-i18n-static="off"]') !== null;
}

function translateTextNode(node: Text, translations: Map<string, string>, language: LanguageCode): void {
  if (isSkipped(node)) return;
  if (!TEXT_SOURCE.has(node)) TEXT_SOURCE.set(node, node.nodeValue || '');
  const source = TEXT_SOURCE.get(node) || '';
  const next = translateLegacyStaticText(source, translations, language);
  if (node.nodeValue !== next) node.nodeValue = next;
}

function translateAttributes(element: Element, translations: Map<string, string>, language: LanguageCode): void {
  if (SKIP_TAGS.has(element.tagName) || element.closest('[data-i18n-static="off"]')) return;
  let stored = ATTR_SOURCE.get(element);
  for (const attr of TRANSLATABLE_ATTRS) {
    const current = element.getAttribute(attr);
    if (!current) continue;
    if (!stored) {
      stored = new Map<string, string>();
      ATTR_SOURCE.set(element, stored);
    }
    if (!stored.has(attr)) stored.set(attr, current);
    const source = stored.get(attr) || '';
    const next = translateLegacyStaticText(source, translations, language);
    if (current !== next) element.setAttribute(attr, next);
  }
}

export function applyLegacyStaticTranslations(root: ParentNode, translations: Map<string, string>, language: LanguageCode): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current = walker.currentNode;
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) translateTextNode(current as Text, translations, language);
    else if (current.nodeType === Node.ELEMENT_NODE) translateAttributes(current as Element, translations, language);
    current = walker.nextNode();
  }
}

export function installLegacyStaticTranslator(root: ParentNode, translations: Map<string, string>, language: LanguageCode): () => void {
  applyLegacyStaticTranslations(root, translations, language);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, translations, language);
        else if (node.nodeType === Node.ELEMENT_NODE) applyLegacyStaticTranslations(node as Element, translations, language);
      }
      if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
        TEXT_SOURCE.set(mutation.target as Text, mutation.target.nodeValue || '');
        translateTextNode(mutation.target as Text, translations, language);
      }
      if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
        const element = mutation.target as Element;
        const attr = mutation.attributeName;
        if (attr && TRANSLATABLE_ATTRS.includes(attr as typeof TRANSLATABLE_ATTRS[number])) {
          const stored = ATTR_SOURCE.get(element);
          stored?.delete(attr);
          translateAttributes(element, translations, language);
        }
      }
    }
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRS],
  });
  return () => observer.disconnect();
}
