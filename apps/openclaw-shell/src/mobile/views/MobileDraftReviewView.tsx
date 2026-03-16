import { MobileViewShell } from '../MobileViewShell';

interface MobileDraftReviewViewProps {
  onBack: () => void;
}

export function MobileDraftReviewView({ onBack }: MobileDraftReviewViewProps) {
  return (
    <MobileViewShell title="Draft Review" onBack={onBack}>
      <div className="placeholder-view">
        <span className="placeholder-view__icon">✉️</span>
        <span className="placeholder-view__title">Draft Review</span>
        <span className="placeholder-view__text">
          Outgoing drafts awaiting your approval will appear here.
        </span>
      </div>
    </MobileViewShell>
  );
}
