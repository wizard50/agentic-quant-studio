import Link from "next/link";

export function NoDatasetsMessage() {
  return (
    <div className="flex-1 p-6 overflow-hidden flex flex-col">
      <div className="relative flex-1 border border-zinc-800 rounded-3xl overflow-hidden bg-zinc-950 flex items-center justify-center">
        <div className="text-center text-zinc-400 max-w-md px-6">
          <p className="text-sm">No candle datasets for this market yet.</p>
          <p className="text-sm mt-2">
            <Link
              href="/data"
              className="text-zinc-200 underline underline-offset-4 hover:text-white"
            >
              Go to Data
            </Link>{" "}
            to ingest your first symbols.
          </p>
        </div>
      </div>
    </div>
  );
}
