"use client";

import * as React from "react";
import { ConfirmDialog, type ConfirmSpec } from "@/components/ui/confirm-dialog";
import { logoutAction } from "@/lib/actions/auth";
import { countUnsentChanges } from "@/lib/offline/idb";

/**
 * Sign out, with a warning first when this tablet still has game day changes the server hasn't
 * received. They are kept on the tablet and go up after the next sign-in, but only from here.
 */
export function SignOutButton({
  className,
  formClassName,
  label,
  children,
}: {
  className: string;
  formClassName?: string;
  label?: string;
  children: React.ReactNode;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const confirmed = React.useRef(false);
  const [spec, setSpec] = React.useState<ConfirmSpec | null>(null);

  const submit = () => {
    confirmed.current = true;
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <form
        ref={formRef}
        action={logoutAction}
        className={formClassName}
        onSubmit={(event) => {
          if (confirmed.current) return;
          event.preventDefault();
          void countUnsentChanges().then((unsent) => {
            if (unsent === 0) return submit();
            setSpec({
              title: "Changes not saved yet",
              description: `${unsent} ${unsent === 1 ? "change is" : "changes are"} still only on this tablet. They'll be sent after you sign in again on this tablet, so don't switch tablets until then. Sign out anyway?`,
              confirmLabel: "Sign out",
              cancelLabel: "Stay signed in",
              tone: "danger",
              onConfirm: submit,
            });
          });
        }}
      >
        <button type="submit" className={className} aria-label={label}>
          {children}
        </button>
      </form>
      <ConfirmDialog spec={spec} onClose={() => setSpec(null)} />
    </>
  );
}
