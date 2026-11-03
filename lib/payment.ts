/**
 * Where players send online payments on game day. Shown on the players' live
 * view and on the Fees tab. The QR image is public/brand/gcash-qr.jpg.
 */
export const ONLINE_PAYMENT = {
  method: "GCash",
  accountName: "Dylan Thomas M.",
  /** As shown to players. */
  mobileDisplay: "0921 632 7461",
  qrSrc: "/brand/gcash-qr.jpg",
} as const;

/** Digits only, for copying into a payment app. */
export const ONLINE_PAYMENT_MOBILE_DIGITS = ONLINE_PAYMENT.mobileDisplay.replace(/\D/g, "");
