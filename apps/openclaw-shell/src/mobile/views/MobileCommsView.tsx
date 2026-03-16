import { MobileViewShell } from '../MobileViewShell';

export function MobileCommsView() {
  return (
    <MobileViewShell title="Comms">
      <div className="placeholder-view">
        <span className="placeholder-view__icon">💬</span>
        <span className="placeholder-view__title">Communications</span>
        <span className="placeholder-view__text">
          Messages, email, and channels will appear here.
        </span>
      </div>
    </MobileViewShell>
  );
}
