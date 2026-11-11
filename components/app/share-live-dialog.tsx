"use client";

import * as React from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { BellRing, Copy, Download, ExternalLink, Share2 } from "lucide-react";
import type { BoardGameDay } from "@/lib/board-types";
import { formatGameDate } from "@/lib/datetime";
import { liveQrFileName, liveShareMessage } from "@/lib/share-message";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

const emptySubscribe = () => () => {};

/* ---------- "Shared this game day's link" memory (per device) ---------- */

const sharedKey = (gameDayId: string) => `kyuwing.live-shared.${gameDayId}`;
const sharedListeners = new Set<() => void>();

/**
 * Whether the live link for this game day was already copied, shared or downloaded on this
 * device. The board only reminds the queue master while this is false.
 */
export function useLiveLinkShared(gameDayId: string): [boolean, () => void] {
  const shared = React.useSyncExternalStore(
    (onChange) => {
      sharedListeners.add(onChange);
      window.addEventListener("storage", onChange);
      return () => {
        sharedListeners.delete(onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(sharedKey(gameDayId)) === "1";
      } catch {
        return false;
      }
    },
    // Never remind during server render.
    () => true,
  );
  const markShared = React.useCallback(() => {
    try {
      window.localStorage.setItem(sharedKey(gameDayId), "1");
    } catch {
      // Private mode: the reminder may come back next time; harmless.
    }
    sharedListeners.forEach((listener) => listener());
  }, [gameDayId]);
  return [shared, markShared];
}

/* ---------- QR code image ---------- */

function fontFamily(className: string) {
  const probe = document.createElement("span");
  probe.className = className;
  document.body.appendChild(probe);
  const family = window.getComputedStyle(probe).fontFamily || "system-ui, sans-serif";
  probe.remove();
  return family;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && context.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/**
 * A printable, shareable PNG: the QR code (high error correction, so the Kyuwing icon can sit
 * in the middle and it still scans), with the game day's name and date underneath.
 */
async function drawLiveQr(url: string, title: string, subtitle: string): Promise<string> {
  const width = 1080;
  const height = 1270;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const count = qr.modules.size;
  const cell = Math.floor(880 / count);
  const side = cell * count;
  const left = Math.round((width - side) / 2);
  const top = 100;
  context.fillStyle = "#0a0a0a";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.modules.get(row, col)) context.fillRect(left + col * cell, top + row * cell, cell, cell);
    }
  }

  // The app icon in the middle, on a white pad so the code around it stays crisp.
  const logo = await loadImage("/icons/icon-512.png");
  const logoSide = Math.round(side * 0.22);
  const pad = Math.round(cell * 1.2);
  const logoLeft = Math.round(width / 2 - logoSide / 2);
  const logoTop = Math.round(top + side / 2 - logoSide / 2);
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.roundRect(
    logoLeft - pad,
    logoTop - pad,
    logoSide + pad * 2,
    logoSide + pad * 2,
    (logoSide + pad * 2) * 0.24,
  );
  context.fill();
  context.drawImage(logo, logoLeft, logoTop, logoSide, logoSide);

  await document.fonts?.ready;
  const display = fontFamily("font-display");
  const body = fontFamily("font-body");
  const textTop = top + side + 80;
  context.textAlign = "center";
  context.textBaseline = "alphabetic";

  context.fillStyle = "#0a0a0a";
  context.font = `800 58px ${display}`;
  context.fillText("Scan for the live queue", width / 2, textTop);

  context.font = `700 42px ${display}`;
  context.fillText(fitText(context, title, width - 140), width / 2, textTop + 72);

  context.fillStyle = "#6b6b60";
  context.font = `500 32px ${body}`;
  context.fillText(fitText(context, subtitle, width - 140), width / 2, textTop + 124);

  // A gold rule along the bottom, the Kyuwing accent.
  context.fillStyle = "#ffd600";
  context.fillRect(0, height - 18, width, 18);

  return canvas.toDataURL("image/png");
}

/** Clipboard API first; the old select-and-copy for browsers that refuse it (e.g. plain http). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0;";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

/* ---------- The dialog ---------- */

/**
 * Share the view-only live board: a ready-to-paste message for the Messenger group chat, the
 * link itself, and a downloadable QR code with the Kyuwing icon. In `reminder` mode it opens on
 * its own once a game day is live, until the link has been shared from this device.
 */
export function ShareLiveDialog({
  open,
  reminder,
  onClose,
  onLater,
  onShared,
  gameDay,
  livePath,
}: {
  open: boolean;
  reminder: boolean;
  onClose: () => void;
  onLater: () => void;
  onShared: () => void;
  gameDay: BoardGameDay;
  livePath: string;
}) {
  const url = React.useSyncExternalStore(
    emptySubscribe,
    () => `${window.location.origin}${livePath}`,
    () => livePath,
  );
  const canShare = React.useSyncExternalStore(
    emptySubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const message = liveShareMessage(
    { name: gameDay.name, date: gameDay.date, venue: gameDay.venue.shortName || gameDay.venue.name },
    url,
  );
  const subtitle = `${formatGameDate(gameDay.date, { weekday: true })} · ${gameDay.venue.name}`;
  const fileName = liveQrFileName(gameDay);

  const [qr, setQr] = React.useState<{ key: string; src: string } | null>(null);
  const qrKey = `${url}|${gameDay.name}|${subtitle}`;
  React.useEffect(() => {
    if (!open || qr?.key === qrKey) return;
    let cancelled = false;
    drawLiveQr(url, gameDay.name, subtitle)
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
    if (await copyText(text)) {
      toast.success(done);
      onShared();
    } else {
      toast.error("Copy failed. Select the text and copy it.");
    }
  };

  const shareMessage = async () => {
    try {
      await navigator.share({ title: `Live queue: ${gameDay.name}`, text: message });
      onShared();
    } catch (error) {
      if ((error as Error)?.name !== "AbortError")
        toast.error("Sharing didn't work. Copy the message instead.");
    }
  };

  const downloadQr = () => {
    if (!qrSrc) return;
    const link = document.createElement("a");
    link.href = qrSrc;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("QR code saved. Post it in the group chat or print it for the venue.");
    onShared();
  };

  return (
    <Modal
      open={open}
      onClose={reminder ? onLater : onClose}
      title="Share the live queue"
      description="Anyone with the link can watch the courts, who's next and the waiting order. They can't change anything."
      size="md"
      footer={
        reminder ? (
          <>
            <Button variant="ghost" onClick={onLater}>
              Remind me later
            </Button>
            <Button
              variant="paper"
              onClick={() => {
                onShared();
                onClose();
              }}
            >
              I already shared it
            </Button>
          </>
        ) : (
          <Button variant="paper" onClick={onClose}>
            Done
          </Button>
        )
      }
    >
      {reminder && (
        <div
          data-trim-id="board.share-reminder"
          className="border-lime/60 bg-lime/15 mb-4 flex items-start gap-3 rounded-2xl border p-3.5"
        >
          <BellRing className="text-ink mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-ink text-[13px] leading-relaxed">
            <strong>The game day is live.</strong> Post this link in the Messenger group chat so players can
            follow the queue from their phones instead of asking you who&apos;s next.
          </p>
        </div>
      )}

      <div className="space-y-5">
        <section>
          <h3 className="text-muted mb-2 text-[11px] font-bold tracking-[0.16em] uppercase">
            Message for the group chat
          </h3>
          <Textarea
            value={message}
            readOnly
            rows={7}
            onFocus={(event) => event.currentTarget.select()}
            className="resize-none text-[13px] leading-relaxed"
            aria-label="Message to paste in Messenger"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              className="flex-1"
              onClick={() => copy(message, "Message copied. Paste it in the Messenger group chat.")}
            >
              <Copy className="h-4 w-4" /> Copy message
            </Button>
            {canShare && (
              <Button variant="paper" className="flex-1" onClick={shareMessage}>
                <Share2 className="h-4 w-4" /> Share…
              </Button>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-muted mb-2 text-[11px] font-bold tracking-[0.16em] uppercase">Just the link</h3>
          <div className="flex gap-2">
            <Input
              value={url}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              className="min-w-0 flex-1 font-mono text-[12px]"
              aria-label="Live view link"
            />
            <Button
              variant="paper"
              size="icon"
              onClick={() => copy(url, "Link copied.")}
              aria-label="Copy link"
              title="Copy link"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label="Open the live view"
              title="Open the live view"
              className="press border-line bg-paper text-ink hover:border-forest/40 grid h-11 w-11 shrink-0 place-items-center rounded-full border shadow-sm"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </section>

        <section className="border-line bg-cream/50 flex flex-col items-center gap-4 rounded-2xl border p-4 sm:flex-row">
          <div className="border-line grid h-44 w-36 shrink-0 place-items-center overflow-hidden rounded-xl border bg-white">
            {qrSrc ? (
              <img
                src={qrSrc}
                alt={`QR code for the live queue of ${gameDay.name}`}
                className="h-full w-full"
              />
            ) : (
              <span className="skeleton h-28 w-28 rounded-lg" />
            )}
          </div>
          <div className="text-center sm:text-left">
            <h3 className="font-display text-base font-bold">QR code</h3>
            <p className="text-muted mt-1 text-[12px] leading-relaxed">
              Players scan it to open the live queue. Post the image in the chat, or print it and tape it by
              the courts.
            </p>
            <Button variant="accent" size="sm" className="mt-3" onClick={downloadQr} disabled={!qrSrc}>
              <Download className="h-3.5 w-3.5" /> Download QR
            </Button>
          </div>
        </section>

        <p className="text-muted text-[11px] leading-relaxed">
          Players see nicknames and levels only, never full names, contacts or fees. They can type their
          nickname to see if they are next.
        </p>
      </div>
    </Modal>
  );
}
