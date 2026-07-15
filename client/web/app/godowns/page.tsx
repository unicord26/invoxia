"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowRight, Warehouse } from "lucide-react";
import { toast } from "sonner";
import type { Item } from "@invoixe/types";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/page-header";
import { Combobox, type ComboOption } from "../../components/combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Godown = { id: string; name: string };
type GodownStock = { godownId: string; itemId: string; qty: number };

function AddGodownDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => api.post("/api/godowns", { name: name.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["godowns"] }); toast.success("Godown added"); setName(""); setOpen(false); },
    onError: () => toast.error("Could not add godown"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="gap-1.5"><Plus className="h-4 w-4" />Add Godown</Button></DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Add a godown</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="gname">Name</Label>
          <Input id="gname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main Warehouse" autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => name.trim() && create.mutate()} disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Saving…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferCard({ godowns, items }: { godowns: Godown[]; items: Item[] }) {
  const qc = useQueryClient();
  const [itemId, setItemId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState("");

  const itemOptions: ComboOption[] = items.map((it) => ({ value: it.id, label: it.name }));
  const n = Number(qty);
  const valid = itemId && fromId && toId && fromId !== toId && Number.isFinite(n) && n > 0;

  const transfer = useMutation({
    mutationFn: () => api.post("/api/godowns/transfer", { itemId, fromGodownId: fromId, toGodownId: toId, qty: n }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["godown-stock"] });
      qc.invalidateQueries({ queryKey: ["godown-transfers"] });
      toast.success("Stock transferred");
      setQty("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Transfer failed"),
  });

  if (godowns.length < 2) {
    return (
      <Card><CardContent className="p-5 text-sm text-gray-500">Add at least two godowns to transfer stock between them.</CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent className="grid gap-3 p-5 md:grid-cols-[1fr_auto_1fr_auto_auto] md:items-end">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-gray-600">Item</Label>
          <Combobox options={itemOptions} value={itemId} onChange={setItemId} placeholder="Pick item…" searchPlaceholder="Search…" emptyText="No items." />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-gray-600">From</Label>
          <Select value={fromId} onValueChange={setFromId}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Source" /></SelectTrigger>
            <SelectContent>{godowns.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="hidden pb-2 md:block"><ArrowRight className="h-4 w-4 text-gray-400" /></div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-gray-600">To</Label>
          <Select value={toId} onValueChange={setToId}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Destination" /></SelectTrigger>
            <SelectContent>{godowns.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-gray-600">Qty</Label>
            <Input type="number" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className="w-24" placeholder="0" />
          </div>
          <Button onClick={() => valid && transfer.mutate()} disabled={!valid || transfer.isPending}>
            {transfer.isPending ? "…" : "Transfer"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GodownsPage() {
  const { data: godowns } = useQuery({ queryKey: ["godowns"], queryFn: () => api.get<Godown[]>("/api/godowns") });
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => api.get<Item[]>("/api/items") });
  const { data: stock } = useQuery({ queryKey: ["godown-stock"], queryFn: () => api.get<GodownStock[]>("/api/godowns/stock") });

  const itemName = useMemo(() => {
    const m = new Map((items ?? []).map((i) => [i.id, i.name]));
    return (id: string) => m.get(id) ?? "—";
  }, [items]);

  // Group per-godown stock rows for display.
  const byGodown = useMemo(() => {
    const m = new Map<string, GodownStock[]>();
    for (const r of stock ?? []) {
      if (!r.godownId) continue;
      const arr = m.get(r.godownId) ?? [];
      if (r.qty !== 0) arr.push(r);
      m.set(r.godownId, arr);
    }
    return m;
  }, [stock]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader title="Godowns" description={`${godowns?.length ?? 0} warehouses`} backHref="/" backLabel="Dashboard">
        <AddGodownDialog />
      </PageHeader>

      <div className="mb-6">
        <TransferCard godowns={godowns ?? []} items={items ?? []} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(godowns ?? []).map((g) => {
          const rows = byGodown.get(g.id) ?? [];
          return (
            <Card key={g.id}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600"><Warehouse className="h-4 w-4" /></span>
                  <h3 className="font-bold text-gray-900">{g.name}</h3>
                </div>
                {rows.length === 0 ? (
                  <p className="text-xs text-gray-400">No stock moved here yet.</p>
                ) : (
                  <ul className="space-y-1">
                    {rows.map((r) => (
                      <li key={r.itemId} className="flex justify-between text-sm">
                        <span className="text-gray-600">{itemName(r.itemId)}</span>
                        <span className="tabular-nums font-medium text-gray-900">{r.qty}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
