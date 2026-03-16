/**
 * generic-adapter.ts — Fallback Adapter
 *
 * Default adapter used for any service that does not have a specific recipe.
 * Provides the minimal observe interface without service-specific logic.
 */

import type { PageContext } from '../../shared/types.js';

export type { PageContext };

/**
 * Returns true if the element is safe to extract text from.
 * Blocks password, payment, and hidden fields.
 */
function sanitizeForObservation(element: Element): boolean {
  const type = element.getAttribute('type');
  if (type === 'password' || type === 'credit-card') return false;
  if (element.getAttribute('autocomplete')?.includes('cc-')) return false;
  if (element.closest('[data-sensitive]')) return false;
  if (element.tagName === 'INPUT' && type === 'hidden') return false;
  return true;
}

/**
 * Walk the DOM and collect visible text, skipping sensitive and hidden elements.
 * Returns innerText of document.body truncated to maxChars.
 */
function sanitizeAndExtract(element: Element, maxChars = 5000): string {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript') {
          return NodeFilter.FILTER_REJECT;
        }
        if (!sanitizeForObservation(parent)) return NodeFilter.FILTER_REJECT;
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const parts: string[] = [];
  let total = 0;
  let node: Node | null;
  while ((node = walker.nextNode()) && total < maxChars) {
    const text = node.textContent?.trim();
    if (text) {
      parts.push(text);
      total += text.length;
    }
  }
  return parts.join(' ').substring(0, maxChars);
}

export function extractPageContext(): PageContext {
  try {
    return {
      url: window.location.href,
      title: document.title,
      selectedText: window.getSelection()?.toString() || '',
      visibleText: sanitizeAndExtract(document.body),
      structuredContent: null,
    };
  } catch (err) {
    console.error('[openclaw/generic-adapter] extractPageContext failed:', err);
    return {
      url: window.location.href,
      title: document.title,
      selectedText: '',
      visibleText: '',
      structuredContent: null,
    };
  }
}

export const genericAdapter = {
  /**
   * Returns basic page context using standard DOM APIs.
   * visibleText is capped at 5000 characters to avoid large payloads.
   */
  extractPageContext,

  /**
   * Generic adapter never has a badge count — returns 0.
   * Service-specific adapters override this.
   */
  getUnreadCount(): number {
    return 0;
  },
};
