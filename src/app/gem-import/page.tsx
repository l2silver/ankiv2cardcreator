import { ApiAppGate } from "@/components/ApiAppGate";
import { GemImportView } from "@/components/GemImportView";
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/french-gem-import");
  return (
    <ApiAppGate>
      <GemImportView />
    </ApiAppGate>
  );
}

