import { ApiAppGate } from "@/components/ApiAppGate";
import { JsonScratchpadView } from "@/components/JsonScratchpadView";
import Link from "next/link";

export default function Page() {
  return (
    <ApiAppGate>
      <div className="flex min-h-screen flex-1 flex-col bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-sm font-semibold tracking-tight">Card creator</h1>
              <p className="mt-0.5 text-xs text-zinc-500">Pick a view.</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/vocab-add"
                className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white hover:bg-sky-500"
              >
                Add vocab word
              </Link>
              <a
                href="#bulk-import"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-zinc-800"
              >
                Bulk import
              </a>
            </div>
          </div>
        </header>
        <main id="bulk-import" className="flex min-h-0 flex-1 flex-col">
          <JsonScratchpadView />
        </main>
      </div>
    </ApiAppGate>
  );
}
