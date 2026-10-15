"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TalentForm } from "@/components/studio/talent-form";
import { useAction } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { zTalentSpec, type TalentSpec } from "@/domain/talent";

export default function NewTalentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [v, setV] = React.useState<{ name: string; spec: TalentSpec }>({ name: "", spec: zTalentSpec.parse({ hair: {} }) });
  const create = useAction((val: { name: string; spec: TalentSpec }) => api.post<{ id: string }>(`/api/projects/${id}/talent`, val), { invalidate: ["/api/projects"], success: "Person created", onSuccess: (r) => router.replace(`/projects/${id}/talent/${r.id}?expand=1`) });
  return (
    <div className="mx-auto max-w-[1000px] px-8 py-8 space-y-6">
      <header className="flex items-end justify-between">
        <div><div className="text-[12px] uppercase tracking-wide text-fg-2">New person</div><h1 className="mt-1 font-display text-[36px] leading-none">Cast an original model</h1><p className="mt-2 text-[13px] text-fg-1 max-w-[640px]">A short brief is enough. The director expands it into face, body and hair notes; then you generate identity sheets and lock the look.</p></div>
        <div className="flex gap-2"><Button variant="ghost" onClick={() => router.back()}>Cancel</Button><Button variant="primary" disabled={!v.name.trim() || create.isPending} onClick={() => create.mutate(v)}>Create &amp; expand brief</Button></div>
      </header>
      <div className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-6"><TalentForm name={v.name} spec={v.spec} onChange={setV} /></div>
    </div>
  );
}
