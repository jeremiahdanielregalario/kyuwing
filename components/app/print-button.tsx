"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button variant="paper" size="sm" onClick={() => window.print()}>
      <Printer className="h-3.5 w-3.5" /> {label}
    </Button>
  );
}
