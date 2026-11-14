"use client";

import * as React from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundOn, primeSounds, setSoundOn, subscribeSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";

/** Turns the board's sound cues on or off for this device. Also readies the sounds on the first touch. */
export function SoundToggle({ variant, className }: { variant: "sidebar" | "icon"; className?: string }) {
  const on = React.useSyncExternalStore(subscribeSound, isSoundOn, () => true);
  React.useEffect(() => primeSounds(), []);
  const Icon = on ? Volume2 : VolumeX;
  const label = on ? "Sounds on. Press to mute." : "Sounds off. Press to turn on.";

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => setSoundOn(!on)}
        aria-pressed={on}
        aria-label={label}
        title={label}
        className={cn(
          "press border-cream/15 bg-cream/5 grid h-9 w-9 place-items-center rounded-full border",
          on ? "text-lime" : "text-cream/50",
          className,
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setSoundOn(!on)}
      aria-pressed={on}
      title={label}
      className={cn(
        "border-cream/15 hover:border-lime/50 hover:bg-lime/10 hover:text-lime inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition",
        on ? "text-cream/70" : "text-cream/45",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {on ? "Sounds on" : "Sounds off"}
    </button>
  );
}
