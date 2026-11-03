"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { hideUiElement, resetHiddenUiElements, showUiElement } from "@/lib/actions/ui-config";
import { TRIM_TARGETS, trimLabel } from "@/lib/ui-trim";

type Badge = { id: string; top: number; left: number; key: string };

function badgeSignature(badges: Badge[]) {
  return badges.map((badge) => badge.key).join("|");
}

/**
 * Developer-only visual editor. Hidden ids are stored globally, so the CSS
 * below applies to every queue master on every device — not just this browser.
 */
export function UiTrimProvider({
  hidden,
  admin,
  children,
}: {
  hidden: string[];
  admin: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [hiddenKeys, setHiddenKeys] = React.useState(hidden);
  const [enabled, setEnabled] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [badges, setBadges] = React.useState<Badge[]>([]);

  // The server value seeds the editor; local state keeps hide/restore instant
  // between router refreshes. A full reload picks up other devices' changes.
  const hiddenSet = React.useMemo(() => new Set(hiddenKeys), [hiddenKeys]);

  const hide = React.useCallback(
    async (id: string) => {
      if (busy) return;
      setBusy(true);
      setHiddenKeys((current) => (current.includes(id) ? current : [...current, id]));
      const result = await hideUiElement(id);
      setBusy(false);

      if (!result.ok) {
        setHiddenKeys((current) => current.filter((entry) => entry !== id));
        toast.error(result.error);
        return;
      }
      toast.success(`Hidden for everyone: ${trimLabel(id)}`);
      router.refresh();
    },
    [busy, router],
  );

  const restore = React.useCallback(
    async (id: string) => {
      if (busy) return;
      setBusy(true);
      setHiddenKeys((current) => current.filter((entry) => entry !== id));
      const result = await showUiElement(id);
      setBusy(false);

      if (!result.ok) {
        setHiddenKeys((current) => (current.includes(id) ? current : [...current, id]));
        toast.error(result.error);
        return;
      }
      toast.success(`Restored: ${trimLabel(id)}`);
      router.refresh();
    },
    [busy, router],
  );

  const resetAll = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const result = await resetHiddenUiElements();
    setBusy(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setHiddenKeys([]);
    toast.success("Every optional element is back.");
    router.refresh();
  }, [busy, router]);

  // Outline the approved targets and float a ✕ over each one while editing.
  React.useEffect(() => {
    if (!enabled) return;

    document.body.classList.add("trim-mode");
    let frame = 0;
    const measure = () => {
      frame = 0;
      const next: Badge[] = [];
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-trim-id]"));
      for (const node of nodes) {
        const id = node.getAttribute("data-trim-id");
        if (!id || hiddenSet.has(id)) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) continue;
        if (rect.bottom < 4 || rect.top > window.innerHeight - 4) continue;
        const top = Math.max(4, Math.min(rect.top + 4, window.innerHeight - 36));
        const left = Math.max(4, Math.min(rect.right - 30, window.innerWidth - 36));
        next.push({ id, top, left, key: `${id}:${Math.round(top)}:${Math.round(left)}` });
      }
      setBadges((current) => (badgeSignature(current) === badgeSignature(next) ? current : next));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    schedule();
    const interval = window.setInterval(schedule, 600);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-trim-id"],
    });

    return () => {
      document.body.classList.remove("trim-mode");
      window.clearInterval(interval);
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [enabled, hiddenSet]);

  // Clicking anywhere inside a highlighted target hides it, without firing the
  // underlying button/link. Toolbar and ✕ badges opt out with data-trim-ui.
  React.useEffect(() => {
    if (!enabled) return;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.closest("[data-trim-ui]")) return;
      const node = target.closest<HTMLElement>("[data-trim-id]");
      if (!node) return;
      const id = node.getAttribute("data-trim-id");
      if (!id || hiddenSet.has(id)) return;
      event.preventDefault();
      event.stopPropagation();
      void hide(id);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, hiddenSet, hide]);

  const hiddenTargets = TRIM_TARGETS.filter((target) => hiddenSet.has(target.id));

  return (
    <>
      <style>{`
${hiddenKeys.map((id) => `[data-trim-id="${id}"] { display: none !important; }`).join("\n")}
body.trim-mode [data-trim-id] { outline: 2px dashed #a8d92f; outline-offset: 3px; border-radius: 3px; cursor: crosshair; }
body.trim-mode [data-trim-id]:hover { outline-style: solid; background-color: rgba(190, 235, 60, 0.10); }
`}</style>

      {children}

      {admin && !enabled && (
        <button
          type="button"
          data-trim-ui
          onClick={() => setEnabled(true)}
          className="bg-forest-deep text-cream border-cream/20 hover:bg-forest fixed right-4 bottom-20 z-50 inline-flex items-center gap-2 rounded-full border px-3.5 py-2.5 text-[12px] font-bold shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)] transition lg:bottom-6"
        >
          <SlidersHorizontal className="h-4 w-4 text-[#a8d92f]" />
          Customize UI
          {hiddenKeys.length > 0 && (
            <span className="bg-cream-deep text-ink-soft rounded-full px-1.5 py-0.5 font-mono text-[9px]">
              {hiddenKeys.length}
            </span>
          )}
        </button>
      )}

      {enabled && (
        <>
          {badges.map((badge) => (
            <button
              key={badge.key}
              type="button"
              data-trim-ui
              onClick={() => void hide(badge.id)}
              title={`Hide ${trimLabel(badge.id)}`}
              aria-label={`Hide ${trimLabel(badge.id)}`}
              style={{ top: badge.top, left: badge.left }}
              className="fixed z-[70] grid h-6 w-6 place-items-center rounded-full bg-[#d8482f] text-white shadow-md ring-2 ring-white/80 transition hover:scale-110 disabled:opacity-50"
              disabled={busy}
            >
              <X className="h-3.5 w-3.5" strokeWidth={3} />
            </button>
          ))}

          <div
            data-trim-ui
            className="fixed inset-x-3 bottom-20 z-[65] mx-auto max-w-3xl lg:bottom-6"
            role="region"
            aria-label="Customize UI"
          >
            {listOpen && (
              <div className="border-cream/15 bg-forest-deep/95 text-cream mb-2 max-h-72 overflow-y-auto rounded-2xl border p-3 shadow-2xl backdrop-blur">
                <div className="mb-2 flex items-center justify-between gap-3 px-1">
                  <p className="text-cream/55 text-[9px] font-bold tracking-[0.16em] uppercase">
                    Hidden for everyone
                  </p>
                  {hiddenTargets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void resetAll()}
                      disabled={busy}
                      className="text-lime inline-flex items-center gap-1 text-[11px] font-semibold hover:underline disabled:opacity-50"
                    >
                      <RotateCcw className="h-3 w-3" /> Restore all
                    </button>
                  )}
                </div>
                {hiddenTargets.length === 0 ? (
                  <p className="text-cream/50 px-1 py-2 text-[12px]">
                    Nothing hidden yet. Click a highlighted block to remove it for everyone.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {hiddenTargets.map((target) => (
                      <div
                        key={target.id}
                        className="bg-cream/[0.06] flex items-center justify-between gap-3 rounded-lg px-2.5 py-2"
                      >
                        <span className="min-w-0">
                          <span className="text-cream/40 block text-[8px] font-bold tracking-[0.12em] uppercase">
                            {target.group}
                          </span>
                          <span className="block truncate text-[12px] font-semibold">{target.label}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => void restore(target.id)}
                          disabled={busy}
                          className="text-lime inline-flex shrink-0 items-center gap-1 rounded-full border border-[#a8d92f]/30 px-2.5 py-1 text-[10px] font-bold hover:bg-[#a8d92f]/10 disabled:opacity-50"
                        >
                          <Eye className="h-3 w-3" /> Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="border-cream/15 bg-forest-deep/95 text-cream flex flex-wrap items-center gap-2 rounded-2xl border p-2.5 shadow-2xl backdrop-blur">
              <span className="text-cream/60 ml-1 hidden text-[11px] sm:inline">
                Click any dashed block to hide it for everyone.
              </span>
              <span className="text-cream/60 ml-1 text-[11px] sm:hidden">Tap a dashed block to hide it.</span>
              <span className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setListOpen((value) => !value)}
                  disabled={busy}
                  className="border-cream/15 text-cream/75 hover:text-cream rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition disabled:opacity-50"
                >
                  Hidden ({hiddenKeys.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnabled(false);
                    setListOpen(false);
                  }}
                  className="bg-lime text-forest-deep rounded-full px-3.5 py-1.5 text-[11px] font-bold transition hover:brightness-105"
                >
                  Done
                </button>
              </span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
