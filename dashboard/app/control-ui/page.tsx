import { EmbeddedDashboardFrame } from "@/components/EmbeddedDashboardFrame";

export default function ControlUiPage() {
  return (
    <EmbeddedDashboardFrame
      title="OpenClaw Control UI"
      description="Mounted from the built-in OpenClaw control UI under the same origin as the shell."
      mountPath="/__mounted/control/"
    />
  );
}
