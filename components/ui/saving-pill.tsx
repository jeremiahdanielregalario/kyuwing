import { LoaderCircle } from "lucide-react";

/** A small "Saving…" pill while a change is on its way to the server. The screen stays usable. */
export function SavingPill({ show }: { show: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`bg-ink text-cream pointer-events-none fixed top-3 left-1/2 z-[60] inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold shadow-lg transition-opacity duration-200 ${show ? "opacity-100" : "opacity-0"}`}
    >
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      {show ? "Saving…" : ""}
    </div>
  );
}
