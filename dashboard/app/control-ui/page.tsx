import { EmbeddedDashboardFrame } from "@/components/EmbeddedDashboardFrame";

export default function ControlUiPage() {
  return (
    <EmbeddedDashboardFrame
      title="Aegilume Control UI"
      description="Mounted from the built-in Aegilume control UI under the same origin as the shell."
      mountPath="/__mounted/control/"
    />
  );
}
