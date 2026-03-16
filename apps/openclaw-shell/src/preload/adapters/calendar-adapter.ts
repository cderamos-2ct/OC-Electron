/**
 * calendar-adapter.ts — Google Calendar Adapter (Phase 1 stub)
 *
 * Provides the observe interface for Google Calendar webview.
 * Phase 4 will add event list extraction and event detail reading.
 */

import { genericAdapter, PageContext } from './generic-adapter';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  isAllDay: boolean;
}

export const calendarAdapter = {
  ...genericAdapter,

  extractPageContext(): PageContext {
    return genericAdapter.extractPageContext();
  },

  getUnreadCount(): number {
    // Calendar has no unread badge concept
    return 0;
  },

  /**
   * TODO Phase 4: Extract all events visible in the current calendar view.
   * Use aria-label attributes on event chips — Google Calendar uses
   * dynamic class names that are not stable across deployments.
   * @returns Empty array until Phase 4 implementation.
   */
  extractVisibleEvents(): CalendarEvent[] {
    // TODO Phase 4: Implement visible event extraction
    // Selector strategy: [data-eventid], [aria-label*="event"], role="gridcell"
    return [];
  },

  /**
   * TODO Phase 4: Extract detail from the currently open event dialog.
   * The event detail panel is a dialog opened on chip click.
   * @returns null until Phase 4 implementation.
   */
  extractEventDetail(): CalendarEvent | null {
    // TODO Phase 4: Implement event detail extraction
    // Selector strategy: [role="dialog"] containing event metadata
    return null;
  },
};
