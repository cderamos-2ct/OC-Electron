import { MobileViewShell } from '../MobileViewShell';

interface MobileGitHubViewProps {
  onBack: () => void;
}

export function MobileGitHubView({ onBack }: MobileGitHubViewProps) {
  return (
    <MobileViewShell title="GitHub" onBack={onBack}>
      <div className="placeholder-view">
        <span className="placeholder-view__icon">🐙</span>
        <span className="placeholder-view__title">GitHub</span>
        <span className="placeholder-view__text">
          Pull requests, issues, and CI status will appear here.
        </span>
      </div>
    </MobileViewShell>
  );
}
