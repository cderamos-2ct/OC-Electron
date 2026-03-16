import { registerOrchestratorTools } from "./src/tools.js";
import { registerAutonomyLoopback } from "./src/autonomy-loopback.js";

export default function register(api) {
  registerOrchestratorTools(api);
  registerAutonomyLoopback(api);
}
