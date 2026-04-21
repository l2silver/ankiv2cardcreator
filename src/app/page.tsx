import { ApiAppGate } from "@/components/ApiAppGate";
import { JsonScratchpadView } from "@/components/JsonScratchpadView";

export default function Page() {
  return (
    <ApiAppGate>
      <JsonScratchpadView />
    </ApiAppGate>
  );
}
