import { MobileViewShell } from '../MobileViewShell';
import { AgentFeed } from '../components/AgentFeed';
import type { FeedEntry } from '../components/AgentFeed';
import type { MobileGatewayClient } from '../lib/mobile-gateway';

interface MobileAgentsViewProps {
  gateway: MobileGatewayClient;
  feedEntries: FeedEntry[];
  onBack: () => void;
}

export function MobileAgentsView({ gateway, feedEntries, onBack }: MobileAgentsViewProps) {
  return (
    <MobileViewShell title="Agents" onBack={onBack}>
      <AgentFeed gateway={gateway} entries={feedEntries} />
    </MobileViewShell>
  );
}
