import { MobileViewShell } from '../MobileViewShell';

interface MobileVaultViewProps {
  onBack: () => void;
}

export function MobileVaultView({ onBack }: MobileVaultViewProps) {
  return (
    <MobileViewShell title="Vault" onBack={onBack}>
      <div className="placeholder-view">
        <span className="placeholder-view__icon">🔐</span>
        <span className="placeholder-view__title">Vault</span>
        <span className="placeholder-view__text">
          Secrets and credentials managed by Themis will appear here.
        </span>
      </div>
    </MobileViewShell>
  );
}
