/**
 * github-adapter.ts — GitHub Adapter (Phase 1 stub)
 *
 * Provides the observe interface for GitHub webview.
 * Phase 4 will add PR detail extraction and notification reading.
 */

import { genericAdapter, PageContext } from './generic-adapter';

export interface GitHubPRDetail {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  author: string;
  baseRef: string;
  headRef: string;
  url: string;
  bodyText: string;
}

export interface GitHubNotification {
  id: string;
  title: string;
  type: string;
  repository: string;
  url: string;
  unread: boolean;
}

export const githubAdapter = {
  ...genericAdapter,

  extractPageContext(): PageContext {
    return genericAdapter.extractPageContext();
  },

  /**
   * Attempts to read the notification count from the GitHub nav badge.
   * GitHub renders: <span aria-label="N notifications"> or a count
   * inside the notifications nav item.
   * Falls back to 0.
   */
  getUnreadCount(): number {
    // Strategy: notification count badge in top nav
    // GitHub: .notification-indicator .mail-status or aria-label
    const badge = document.querySelector<HTMLElement>(
      '[aria-label*="notification"]',
    );
    if (badge) {
      const label = badge.getAttribute('aria-label') ?? '';
      const match = label.match(/(\d+)/);
      if (match) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count)) return count;
      }
      // Try inner text for rendered count
      const text = badge.textContent?.trim();
      if (text) {
        const n = parseInt(text, 10);
        if (!isNaN(n)) return n;
      }
    }
    return 0;
  },

  /**
   * TODO Phase 4: Extract PR detail from the currently open pull request page.
   * Use stable selectors: [data-hpc], meta tags, and semantic heading structure.
   * @returns null until Phase 4 implementation.
   */
  extractPRDetail(): GitHubPRDetail | null {
    // TODO Phase 4: Implement PR detail extraction
    // Selector strategy: .gh-header-title, .base-ref, .head-ref, .comment-body
    return null;
  },

  /**
   * TODO Phase 4: Extract the list of unread notifications from the
   * notifications page (/notifications).
   * @returns Empty array until Phase 4 implementation.
   */
  extractNotifications(): GitHubNotification[] {
    // TODO Phase 4: Implement notifications list extraction
    // Selector strategy: .notifications-list-item, [data-notification-id]
    return [];
  },
};
