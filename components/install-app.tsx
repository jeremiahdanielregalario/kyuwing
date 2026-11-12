"use client";

import * as React from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Chrome / Edge / Samsung Internet's install event (not in the DOM typings yet). */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// The browser can fire `beforeinstallprompt` before any install button mounts,
// so it is captured once here, at module load, and shared through a tiny store.
let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone and iPad Safari never fire an install event; they install from the Share menu. */
function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

type InstallMode = "none" | "prompt" | "ios";

function readMode(): InstallMode {
  if (installed || isStandalone()) return "none";
  if (deferred) return "prompt";
  return isIos() ? "ios" : "none";
}

function useInstallMode() {
  return React.useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      const media = window.matchMedia("(display-mode: standalone)");
      media.addEventListener("change", onChange);
      return () => {
        listeners.delete(onChange);
        media.removeEventListener("change", onChange);
      };
    },
    readMode,
    () => "none" as InstallMode,
  );
}

/** Registers the service worker once per page load. Rendered in the root layout. */
export function ServiceWorkerRegistration() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not fatal: the site works the same without it, it just can't show the offline page.
    });
  }, []);
  return null;
}

async function promptInstall() {
  const event = deferred;
  if (!event) return;
  await event.prompt();
  await event.userChoice.catch(() => null);
  // A prompt can only be used once; the browser fires a new event if it can ask again.
  deferred = null;
  notify();
}

/**
 * "Install app": opens the browser's install prompt where there is one (Chrome, Edge,
 * Android), or shows the Add to Home Screen steps on iPhone and iPad. Hidden once installed
 * and in browsers that can't install.
 */
export function InstallAppButton({
  variant = "sidebar",
  className,
}: {
  variant?: "sidebar" | "icon" | "inline";
  className?: string;
}) {
  const mode = useInstallMode();
  const [iosOpen, setIosOpen] = React.useState(false);

  if (mode === "none") return null;

  const install = () => {
    if (mode === "ios") setIosOpen(true);
    else void promptInstall();
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={install}
          className={cn(
            "press border-cream/15 bg-cream/5 text-cream/70 hover:text-lime grid h-9 w-9 place-items-center rounded-full border",
            className,
          )}
          aria-label="Install the Kyuwing app"
          title="Install app"
        >
          <Download className="h-4 w-4" />
        </button>
      ) : variant === "sidebar" ? (
        <button
          type="button"
          onClick={install}
          className={cn(
            "border-lime/40 bg-lime/10 text-lime hover:bg-lime/20 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition",
            className,
          )}
        >
          <Download className="h-3.5 w-3.5" /> Install app
        </button>
      ) : (
        <Button variant="paper" size="sm" onClick={install} className={className}>
          <Download className="h-3.5 w-3.5" /> Install the app
        </Button>
      )}

      <Modal
        open={iosOpen}
        onClose={() => setIosOpen(false)}
        title="Install Kyuwing"
        description="Add it to your Home Screen and it opens full screen, like an app."
        size="sm"
      >
        <IosInstallSteps />
      </Modal>
    </>
  );
}

function IosInstallSteps() {
  return (
    <>
      <ol className="space-y-3 text-sm">
        <li className="flex items-start gap-3">
          <span className="bg-forest text-cream grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold">
            1
          </span>
          <span>
            In Safari, tap the <strong>Share</strong> button{" "}
            <Share className="inline h-4 w-4 align-[-3px]" aria-label="Share" /> (at the bottom of the screen,
            or at the top on iPad).
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="bg-forest text-cream grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold">
            2
          </span>
          <span>
            Scroll down and tap <strong>Add to Home Screen</strong>{" "}
            <SquarePlus className="inline h-4 w-4 align-[-3px]" aria-hidden="true" />.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="bg-forest text-cream grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold">
            3
          </span>
          <span>
            Tap <strong>Add</strong>. Kyuwing appears on your Home Screen; open it from there.
          </span>
        </li>
      </ol>
      <p className="text-muted mt-4 text-xs leading-relaxed">
        In Chrome on iPhone, the Share button is in the address bar. If you don&apos;t see{" "}
        <strong>Add to Home Screen</strong>, open this page in Safari.
      </p>
    </>
  );
}

// After a queue master signs in, the app suggests installing it once. The flag lives in
// sessionStorage: set by the sign-in form, cleared when the pop-up is answered, and gone
// with the tab, so the reminder comes back on the next sign-in only if it's still not installed.
const REMINDER_KEY = "kyuwing:install-reminder";
const reminderListeners = new Set<() => void>();

/** Called by the sign-in form on success, before navigating to the app. */
export function queueInstallReminder() {
  try {
    sessionStorage.setItem(REMINDER_KEY, "1");
  } catch {
    // Private mode or storage disabled: skip the reminder.
  }
}

function readReminder() {
  try {
    return sessionStorage.getItem(REMINDER_KEY) === "1";
  } catch {
    return false;
  }
}

function clearReminder() {
  try {
    sessionStorage.removeItem(REMINDER_KEY);
  } catch {
    // Ignore.
  }
  reminderListeners.forEach((listener) => listener());
}

/**
 * The post-sign-in "Get the app" pop-up. Rendered in the app shell; shows only right after
 * signing in, and only in a browser that can install Kyuwing and hasn't yet.
 */
export function InstallReminder() {
  const mode = useInstallMode();
  const pending = React.useSyncExternalStore(
    (onChange) => {
      reminderListeners.add(onChange);
      return () => reminderListeners.delete(onChange);
    },
    readReminder,
    () => false,
  );
  // Keep the last mode while the sheet animates out, so its content doesn't flip.
  const [shownMode, setShownMode] = React.useState<InstallMode>("none");
  const open = pending && mode !== "none";
  if (open && shownMode !== mode) setShownMode(mode);

  const install = async () => {
    clearReminder();
    await promptInstall();
  };

  return (
    <Modal
      open={open}
      onClose={clearReminder}
      title="Get the Kyuwing app"
      description="For the best experience on game day, install Kyuwing on this device."
      size="sm"
      footer={
        shownMode === "ios" ? (
          <Button onClick={clearReminder} className="w-full sm:w-auto">
            Got it
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={clearReminder}>
              Not now
            </Button>
            <Button onClick={install}>
              <Download className="h-4 w-4" /> Install app
            </Button>
          </>
        )
      }
    >
      <ul className="text-ink/80 mb-4 space-y-1.5 text-sm">
        <li>• Opens full screen, so the board gets the whole screen.</li>
        <li>• One tap from your Home Screen on game day.</li>
        <li>• Updates itself whenever there&apos;s a new version.</li>
      </ul>
      {shownMode === "ios" ? (
        <IosInstallSteps />
      ) : (
        <p className="text-muted text-xs leading-relaxed">
          You can also install it later with <strong>Install app</strong> in the sidebar, or the download icon
          at the top on phones.
        </p>
      )}
    </Modal>
  );
}
