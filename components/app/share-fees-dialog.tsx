"use client";

import * as React from "react";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, QrCode, Share2, ShieldAlert } from "lucide-react";
import type { BoardGameDay } from "@/lib/board-types";
import { formatGameDate } from "@/lib/datetime";
import { feesShareMessage, liveQrFileName } from "@/lib/share-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { copyText, drawLiveQr, useDeviceFlag } from "@/components/app/share-live-dialog";

const emptySubscribe = () => () => {};

/**
 * "Share with finance" on the Fees page: a button, plus a pop-up with the view-only fees link and
 * a QR code for the finance member to scan. It opens on its own the first time the queue master
 * opens Fees for this game day on this device; after that, from the button.
 */
export function ShareFeesButton({ gameDay, feesPath }: { gameDay: BoardGameDay; feesPath: string }) {
  const [seen, markSeen] = useDeviceFlag(`kyuwing.fees-link-seen.${gameDay.id}`);
  const [open, setOpen] = React.useState(false);
  const close = () => {
    setOpen(false);
    markSeen();
  };

  return (
    <>
      <Button variant="paper" size="sm" onClick={() => setOpen(true)}>
        <QrCode className="h-3.5 w-3.5" /> Share with finance
      </Button>
      <ShareFeesDialog
        open={open || !seen}
        firstTime={!open && !seen}
        onClose={close}
        gameDay={gameDay}
        feesPath={feesPath}
      />
    </>
  );
}

function ShareFeesDialog({
  open,
  firstTime,
  onClose,
  gameDay,
  feesPath,
}: {
  open: boolean;
  firstTime: boolean;
  onClose: () => void;
  gameDay: BoardGameDay;
  feesPath: string;
}) {
  const url = React.useSyncExternalStore(
    emptySubscribe,
    () => `${window.location.origin}${feesPath}`,
    () => feesPath,
  );
  const canShare = React.useSyncExternalStore(
    emptySubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const venue = gameDay.venue.shortName || gameDay.venue.name;
  const message = feesShareMessage({ name: gameDay.name, date: gameDay.date, venue }, url);
  const subtitle = `${formatGameDate(gameDay.date, { weekday: true })} · ${gameDay.venue.name}`;

  const [qr, setQr] = React.useState<{ key: string; src: string } | null>(null);
  const qrKey = `${url}|${gameDay.name}|${subtitle}`;
  React.useEffect(() => {
    if (!open || qr?.key === qrKey) return;
    let cancelled = false;
    drawLiveQr(url, gameDay.name, subtitle, "Scan for the fees")
      .then((src) => {
        if (!cancelled) setQr({ key: qrKey, src });
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't draw the QR code. Share the link instead.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, qr?.key, qrKey, url, gameDay.name, subtitle]);
  const qrSrc = qr?.key === qrKey ? qr.src : null;

  const copy = async (text: string, done: string) => {
    if (await copyText(text)) toast.success(done);
    else toast.error("Copy failed. Select the text and copy it.");
  };

  const share = async () => {
    try {
      await navigator.share({ title: `Fees: ${gameDay.name}`, text: message });
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") toast.error("Sharing didn't work. Copy the link instead.");
    }
  };

  const downloadQr = () => {
    if (!qrSrc) return;
    const link = document.createElement("a");
    link.href = qrSrc;
    link.download = liveQrFileName(gameDay, "fees");
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("QR code saved.");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share the fees with finance"
      description="The finance officer scans the code to follow every player's fee and payment as you record it. View only: they can't change anything."
      size="md"
      footer={
        <Button variant="paper" onClick={onClose}>
          {firstTime ? "Got it" : "Done"}
        </Button>
      }
    >
      <div className="space-y-5">
        <section className="border-line bg-cream/50 flex flex-col items-center gap-4 rounded-2xl border p-4 sm:flex-row">
          <div className="border-line grid h-56 w-48 shrink-0 place-items-center overflow-hidden rounded-xl border bg-white">
            {qrSrc ? (
              <img src={qrSrc} alt={`QR code for the fees of ${gameDay.name}`} className="h-full w-full" />
            ) : (
              <span className="skeleton h-36 w-36 rounded-lg" />
            )}
          </div>
          <div className="text-center sm:text-left">
            <h3 className="font-display text-base font-bold">Scan to open</h3>
            <p className="text-muted mt-1 text-[12px] leading-relaxed">
              Hold this screen up to the finance officer&apos;s phone camera. The page refreshes on its own,
              so they can record payments as players settle up.
            </p>
            <Button variant="accent" size="sm" className="mt-3" onClick={downloadQr} disabled={!qrSrc}>
              <Download className="h-3.5 w-3.5" /> Download QR
            </Button>
          </div>
        </section>

        <section>
          <h3 className="text-muted mb-2 text-[11px] font-bold tracking-[0.16em] uppercase">
            Or send the link
          </h3>
          <div className="flex gap-2">
            <Input
              value={url}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 font-mono text-[12px]"
              aria-label="Fees link"
            />
            <Button
              variant="paper"
              size="icon"
              onClick={() => copy(url, "Link copied. Send it to the finance officer.")}
              aria-label="Copy link"
              title="Copy link"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label="Open the fees sheet"
              title="Open the fees sheet"
              className="press border-line bg-paper text-ink hover:border-forest/40 grid h-11 w-11 shrink-0 place-items-center rounded-full border shadow-sm"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          {canShare && (
            <Button variant="paper" className="mt-2 w-full" onClick={share}>
              <Share2 className="h-4 w-4" /> Share…
            </Button>
          )}
        </section>

        <div className="border-coral/30 bg-coral-soft/60 flex items-start gap-3 rounded-2xl border p-3.5">
          <ShieldAlert className="text-coral mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-ink text-[12px] leading-relaxed">
            Anyone with this link sees every player&apos;s nickname and surname, membership status, games, fee
            and payment (no given names or contacts). Send it to the finance officer directly, not to the
            players&apos; group chat. It is a different link from the live queue.
          </p>
        </div>
      </div>
    </Modal>
  );
}
