import { MobileViewShell } from '../MobileViewShell';

export function MobileCalendarView() {
  return (
    <MobileViewShell title="Calendar">
      <div className="placeholder-view">
        <span className="placeholder-view__icon">📅</span>
        <span className="placeholder-view__title">Calendar</span>
        <span className="placeholder-view__text">
          Upcoming events and meetings will appear here.
        </span>
      </div>
    </MobileViewShell>
  );
}
