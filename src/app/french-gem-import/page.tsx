import { ApiAppGate } from "@/components/ApiAppGate";
import { GemImportView } from "@/components/GemImportView";

export default function Page() {
  return (
    <ApiAppGate>
      <GemImportView />
    </ApiAppGate>
  );
}

