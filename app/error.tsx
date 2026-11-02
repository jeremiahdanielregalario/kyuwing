"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[70dvh] place-items-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <span className="bg-coral-soft mx-auto grid h-12 w-12 place-items-center rounded-full text-[#a8331a]">
          <TriangleAlert className="h-5 w-5" />
        </span>
        <h1 className="font-display mt-4 text-2xl font-extrabold tracking-tight">
          Something went out of bounds.
        </h1>
        <p className="text-muted mt-2 text-[13px] leading-relaxed">
          The board hit an unexpected error. Try again — if it keeps happening, refresh the page and check the
          server logs.
        </p>
        {error.digest && <p className="text-muted/70 mt-2 font-mono text-[10px]">Ref: {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={reset}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
          <Button variant="paper" onClick={() => router.push("/app")}>
            Back to board
          </Button>
        </div>
      </div>
    </div>
  );
}
