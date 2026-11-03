"use client";

import * as React from "react";
import { Check, Copy, Smartphone } from "lucide-react";
import { ONLINE_PAYMENT, ONLINE_PAYMENT_MOBILE_DIGITS } from "@/lib/payment";

/** Game-day online payment details with the GCash QR and a one-tap copy of the number. */
export function PaymentCard() {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ONLINE_PAYMENT_MOBILE_DIGITS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the number is still on screen to type.
    }
  };

  return (
    <section className="border-line bg-paper rounded-2xl border p-4">
      <h2 className="font-display inline-flex items-center gap-1.5 text-base font-bold">
        <Smartphone className="h-4 w-4" /> Pay online
      </h2>
      <p className="text-muted text-[11px]">
        Game day online payment · {ONLINE_PAYMENT.method}. Scan the QR, or send to the number below.
      </p>

      <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <img
          src={ONLINE_PAYMENT.qrSrc}
          alt={`${ONLINE_PAYMENT.method} QR code for ${ONLINE_PAYMENT.accountName}`}
          width={180}
          height={180}
          className="border-line h-44 w-44 shrink-0 rounded-xl border bg-white"
        />
        <div className="w-full min-w-0 space-y-2 text-center sm:text-left">
          <p className="text-muted text-[10px] font-bold tracking-[0.14em] uppercase">Account name</p>
          <p className="text-[15px] font-bold">{ONLINE_PAYMENT.accountName}</p>
          <p className="text-muted pt-1 text-[10px] font-bold tracking-[0.14em] uppercase">
            {ONLINE_PAYMENT.method} number
          </p>
          <p className="font-mono text-xl font-bold tracking-wide">{ONLINE_PAYMENT.mobileDisplay}</p>
          <button
            type="button"
            onClick={copy}
            className="border-line bg-cream hover:bg-cream-deep inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy number"}
          </button>
          <p className="text-muted text-[11px]">
            Transfer fees may apply. Tell the finance member your nickname once you have paid.
          </p>
        </div>
      </div>
    </section>
  );
}
