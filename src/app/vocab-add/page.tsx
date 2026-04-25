import { ApiAppGate } from "@/components/ApiAppGate";
import { VocabAddOneView } from "@/components/VocabAddOneView";

export default function Page() {
  return (
    <ApiAppGate>
      <VocabAddOneView />
    </ApiAppGate>
  );
}

