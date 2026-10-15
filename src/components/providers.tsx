"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: 1 } } }));
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        {children}
        <Toaster position="bottom-right" theme="dark" toastOptions={{ style: { background: "var(--bg-2)", color: "var(--fg-0)", border: "1px solid var(--line)", fontFamily: "var(--font-sans)", fontSize: 13 } }} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
