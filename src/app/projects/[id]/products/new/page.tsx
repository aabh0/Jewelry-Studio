"use client";
import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ProductForm, defaultProductSpec, type ProductFormValue } from "@/components/studio/product-form";
import { useAction } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { deriveInvariants, validateProductSpec } from "@/domain/product";

export default function NewProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const spec = React.useMemo(() => defaultProductSpec(), []);
  const [v, setV] = React.useState<ProductFormValue>({ name: "", sku: "", spec, invariants: deriveInvariants(spec), notes: "" });
  const create = useAction((val: ProductFormValue) => api.post<{ id: string }>(`/api/projects/${id}/products`, { name: val.name, sku: val.sku || null, spec: val.spec, invariants: val.invariants, notes: val.notes || null }), { invalidate: ["/api/projects"], success: "Product created — now add reference photos", onSuccess: (r) => router.replace(`/projects/${id}/products/${r.id}`) });
  const valid = v.name.trim().length > 0 && validateProductSpec(v.spec).errors.length === 0;
  return (
    <div className="mx-auto max-w-[1000px] px-8 py-8 space-y-6">
      <header className="flex items-end justify-between">
        <div><div className="text-[12px] uppercase tracking-wide text-fg-2">New product</div><h1 className="mt-1 font-display text-[36px] leading-none">Describe the piece</h1><p className="mt-2 text-[13px] text-fg-1 max-w-[640px]">Be exact: prong count, stone shape and metal color are the things AI gets wrong. These become the fidelity invariants that go into every prompt and every QA pass.</p></div>
        <div className="flex gap-2"><Button variant="ghost" onClick={() => router.back()}>Cancel</Button><Button variant="primary" disabled={!valid || create.isPending} onClick={() => create.mutate(v)}>Create &amp; add references</Button></div>
      </header>
      <div className="rounded-[var(--radius-lg)] bg-bg-1 hairline p-6"><ProductForm value={v} onChange={setV} /></div>
    </div>
  );
}
