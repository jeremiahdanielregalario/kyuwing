"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { toast } from "sonner";
import { loginAction, type LoginMode } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function LoginForm({
  next,
  mode = "master",
  adminEnabled = true,
  showDevHint,
}: {
  next: string;
  mode?: LoginMode;
  adminEnabled?: boolean;
  showDevHint: boolean;
}) {
  const router = useRouter();
  const isAdmin = mode === "admin";
  const [name, setName] = React.useState(isAdmin ? "Developer" : "");
  const [pin, setPin] = React.useState("");
  const [showPin, setShowPin] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isAdmin && !adminEnabled) return;
    setError(null);
    startTransition(async () => {
      const result = await loginAction(name, pin, mode);
      if (result.ok) {
        toast.success(result.message ?? "Welcome to the board.");
        router.replace(next || "/app");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {isAdmin && !adminEnabled && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-3.5 py-3 text-[12px] leading-relaxed text-amber-900">
          <p className="font-semibold">Developer sign-in is not configured.</p>
          <p className="mt-0.5">
            Add an <span className="font-mono">ADMIN_PIN</span> environment variable in the deployment
            settings, then redeploy.
          </p>
        </div>
      )}

      <Field
        label={isAdmin ? "Your name (optional)" : "Your name"}
        hint={
          isAdmin
            ? "Shown on the board while you edit the interface."
            : "Shown on the board so players know who is running the queue."
        }
      >
        <div className="relative">
          <UserRound className="text-muted pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="pl-10"
            maxLength={40}
            autoComplete="name"
            placeholder={isAdmin ? "Developer" : "EJ Mallilin"}
          />
        </div>
      </Field>

      <Field label={isAdmin ? "Developer PIN" : "Queue master PIN"}>
        <div className="relative">
          <LockKeyhole className="text-muted pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
          <Input
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            className="pr-11 pl-10 font-mono tracking-[0.3em]"
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            autoComplete="current-password"
            placeholder="••••"
            autoFocus
            maxLength={20}
            disabled={isAdmin && !adminEnabled}
          />
          <button
            type="button"
            onClick={() => setShowPin((value) => !value)}
            className="text-muted hover:bg-cream-deep hover:text-ink absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full"
            aria-label={showPin ? "Hide PIN" : "Show PIN"}
          >
            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>

      {error && (
        <div className="border-coral/30 bg-coral-soft rounded-xl border px-3.5 py-3 text-[13px] font-medium text-[#a8331a]">
          {error}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={pending}
        disabled={isAdmin && !adminEnabled}
      >
        {pending
          ? isAdmin
            ? "Unlocking…"
            : "Opening the board…"
          : isAdmin
            ? "Enter developer mode"
            : "Enter the queue board"}
        {!pending && <ArrowRight className="h-4 w-4" />}
      </Button>

      {showDevHint && (
        <p className="text-muted text-center text-[11px]">
          Local development PIN: <span className="text-forest font-mono font-bold">1234</span> — change it in{" "}
          <span className="font-mono">.env</span> before deploying.
        </p>
      )}
    </form>
  );
}
