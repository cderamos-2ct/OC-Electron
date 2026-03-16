import { MobileViewShell } from '../MobileViewShell';

interface MobileBrowserViewProps {
  onBack: () => void;
}

export function MobileBrowserView({ onBack }: MobileBrowserViewProps) {
  return (
    <MobileViewShell title="Browser" onBack={onBack}>
      <div className="placeholder-view">
        <span className="placeholder-view__icon">🌐</span>
        <span className="placeholder-view__title">Browser</span>
        <span className="placeholder-view__text">
          Inline browsing and web research will appear here.
        </span>
      </div>
    </MobileViewShell>
  );
}
