/**
 * gmail-adapter.ts — Gmail DOM Adapter (Phase 1 stub)
 *
 * Gmail uses dynamic, hashed class names that change with deployments.
 * All selectors must use aria-label and role attributes for stability.
 *
 * Phase 4 will flesh out thread list extraction, open thread reading,
 * and compose/reply actions.
 */

import { genericAdapter, PageContext } from './generic-adapter';

export interface GmailThread {
  id: string;
  subject: string;
  sender: string;
  snippet: string;
  unread: boolean;
  date: string;
}

export const gmailAdapter = {
  ...genericAdapter,

  extractPageContext(): PageContext {
    return genericAdapter.extractPageContext();
  },

  /**
   * Attempts to parse Gmail's inbox unread count from the page title
   * or the aria-label on the inbox navigation link.
   *
   * Gmail renders something like:
   *   <a aria-label="Inbox (42 unread)">
   * or sets the document title to "(42) Inbox - Gmail".
   *
   * Falls back to 0 if no badge element is found.
   */
  getUnreadCount(): number {
    // Strategy 1: document title "(N) Inbox - Gmail"
    const titleMatch = document.title.match(/^\((\d+)\)/);
    if (titleMatch) {
      const count = parseInt(titleMatch[1], 10);
      if (!isNaN(count)) return count;
    }

    // Strategy 2: aria-label on inbox nav link
    // Gmail: <a aria-label="Inbox (42 unread)" ...>
    const inboxLink = document.querySelector<HTMLElement>(
      '[aria-label*="Inbox"]',
    );
    if (inboxLink) {
      const label = inboxLink.getAttribute('aria-label') ?? '';
      const match = label.match(/\((\d+)/);
      if (match) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count)) return count;
      }
    }

    return 0;
  },

  /**
   * TODO Phase 4: Extract the list of visible threads from the inbox.
   * Use aria-label, role="row", and data attributes — never dynamic class names.
   * @returns Empty array until Phase 4 implementation.
   */
  extractThreadList(): GmailThread[] {
    // TODO Phase 4: Implement thread list extraction
    // Selector strategy: role="main" > [role="row"][aria-checked]
    return [];
  },

  /**
   * TODO Phase 4: Extract the currently open email thread.
   * Return structured thread data including sender, subject, and body text.
   * @returns null until Phase 4 implementation.
   */
  extractOpenThread(): GmailThread | null {
    // TODO Phase 4: Implement open thread extraction
    // Selector strategy: [role="main"] [aria-label*="Message Body"]
    return null;
  },
};
