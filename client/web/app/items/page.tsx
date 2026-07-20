"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { MoreHorizontal, Trash2, SlidersHorizontal, Package } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@invoixe/core";
import { type Item } from "@invoixe/types";
import Link from "next/link";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/page-header";
import { DataTable, type Column } from "../../components/data-table";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ItemWithStock = Item & { currentStock: number };

// Controlled so it can live OUTSIDE the DropdownMenu — a Dialog nested inside
// DropdownMenuContent unmounts the moment the menu closes.
function AdjustStockDialog({
  item,
  open,
  onOpenChange,
}: {
  item: ItemWithStock;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [delta, setDelta] = useState("");

  const adjust = useMutation({
    mutationFn: (qty: number) => api.post(`/api/items/${item.id}/adjust`, { qty }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Stock adjusted");
      setDelta("");
      onOpenChange(false);
    },
    onError: () => toast.error("Could not adjust stock"),
  });

  const n = Number(delta);
  const valid = Number.isFinite(n) && n !== 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust stock — {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delta">Change (use −3 to reduce, +10 to add)</Label>
          <Input
            id="delta"
            inputMode="numeric"
            placeholder="e.g. +10 or -3"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-gray-500">
            Current stock: <span className="font-medium">{item.currentStock}</span>
            {valid && <> → new: <span className="font-medium">{item.currentStock + n}</span></>}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => valid && adjust.mutate(n)} disabled={!valid || adjust.isPending}>
            {adjust.isPending ? "Saving…" : "Adjust"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Batch + serial management for a tracked item.
function BatchSerialDialog({ item, open, onOpenChange }: { item: ItemWithStock; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  type Batch = { id: string; batchNo: string; expiryDate: string | null; qty: number };
  type Serial = { id: string; serial: string; status: string };
  const batches = useQuery({ queryKey: ["batches", item.id], queryFn: () => api.get<Batch[]>(`/api/items/${item.id}/batches`), enabled: open && item.trackBatch });
  const serials = useQuery({ queryKey: ["serials", item.id], queryFn: () => api.get<Serial[]>(`/api/items/${item.id}/serials`), enabled: open && item.trackSerial });

  const [batchNo, setBatchNo] = useState("");
  const [expiry, setExpiry] = useState("");
  const [batchQty, setBatchQty] = useState("");
  const [serial, setSerial] = useState("");

  const addBatch = useMutation({
    mutationFn: () => api.post(`/api/items/${item.id}/batches`, { batchNo: batchNo.trim(), expiryDate: expiry || null, qty: Number(batchQty) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["batches", item.id] }); setBatchNo(""); setExpiry(""); setBatchQty(""); toast.success("Batch added"); },
    onError: () => toast.error("Could not add batch"),
  });
  const delBatch = useMutation({ mutationFn: (id: string) => api.del(`/api/items/${item.id}/batches/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["batches", item.id] }) });
  const addSerial = useMutation({
    mutationFn: () => api.post(`/api/items/${item.id}/serials`, { serial: serial.trim() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["serials", item.id] }); setSerial(""); toast.success("Serial added"); },
    onError: (e) => toast.error(e instanceof Error && e.message.includes("duplicate") ? "Serial already exists" : "Could not add serial"),
  });
  const delSerial = useMutation({ mutationFn: (id: string) => api.del(`/api/items/${item.id}/serials/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["serials", item.id] }) });

  const only = item.trackBatch && !item.trackSerial ? "batch" : !item.trackBatch && item.trackSerial ? "serial" : "batch";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{item.name} — batches &amp; serials</DialogTitle></DialogHeader>
        <Tabs defaultValue={only}>
          <TabsList>
            <TabsTrigger value="batch" disabled={!item.trackBatch}>Batches</TabsTrigger>
            <TabsTrigger value="serial" disabled={!item.trackSerial}>Serials</TabsTrigger>
          </TabsList>
          <TabsContent value="batch" className="space-y-3 pt-3">
            <div className="flex items-end gap-2">
              <div className="flex-1"><Label className="mb-1 block text-xs">Batch no.</Label><Input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} placeholder="B-001" /></div>
              <div><Label className="mb-1 block text-xs">Expiry</Label><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></div>
              <div className="w-20"><Label className="mb-1 block text-xs">Qty</Label><Input type="number" step="any" value={batchQty} onChange={(e) => setBatchQty(e.target.value)} /></div>
              <Button onClick={() => batchNo.trim() && addBatch.mutate()} disabled={!batchNo.trim() || addBatch.isPending}>Add</Button>
            </div>
            <ul className="divide-y rounded-lg border">
              {batches.data?.length === 0 && <li className="p-3 text-sm text-gray-400">No batches yet.</li>}
              {batches.data?.map((b) => (
                <li key={b.id} className="flex items-center justify-between p-2.5 text-sm">
                  <span><span className="font-medium">{b.batchNo}</span>{b.expiryDate && <span className="text-gray-500"> · exp {new Date(b.expiryDate).toLocaleDateString()}</span>} · qty {b.qty}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-600" onClick={() => delBatch.mutate(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="serial" className="space-y-3 pt-3">
            <div className="flex items-end gap-2">
              <div className="flex-1"><Label className="mb-1 block text-xs">Serial no.</Label><Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="SN-12345" /></div>
              <Button onClick={() => serial.trim() && addSerial.mutate()} disabled={!serial.trim() || addSerial.isPending}>Add</Button>
            </div>
            <ul className="divide-y rounded-lg border">
              {serials.data?.length === 0 && <li className="p-3 text-sm text-gray-400">No serials yet.</li>}
              {serials.data?.map((s) => (
                <li key={s.id} className="flex items-center justify-between p-2.5 text-sm">
                  <span><span className="font-medium">{s.serial}</span> <Badge variant="secondary" className="ml-1">{s.status === "in" ? "in stock" : "sold"}</Badge></span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-600" onClick={() => delSerial.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Row actions: menu + the adjust / batch-serial dialogs kept as siblings (not inside the menu).
function ItemActions({ item, onDelete }: { item: ItemWithStock; onDelete: () => void }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [bsOpen, setBsOpen] = useState(false);
  const tracks = item.trackBatch || item.trackSerial;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Row actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.type === "product" && (
            <DropdownMenuItem onSelect={() => setAdjustOpen(true)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Adjust stock
            </DropdownMenuItem>
          )}
          {tracks && (
            <DropdownMenuItem onSelect={() => setBsOpen(true)}>
              <Package className="mr-2 h-4 w-4" />
              Batches &amp; serials
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {item.type === "product" && (
        <AdjustStockDialog item={item} open={adjustOpen} onOpenChange={setAdjustOpen} />
      )}
      {tracks && <BatchSerialDialog item={item} open={bsOpen} onOpenChange={setBsOpen} />}
    </>
  );
}

function ItemsList() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const rawOnly = searchParams.get("category") === "raw";

  const { data: items, isLoading, error } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.get<ItemWithStock[]>("/api/items"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("Item deleted");
    },
    onError: () => toast.error("Could not delete item"),
  });

  const columns: Column<ItemWithStock>[] = [
    {
      key: "item",
      header: "Item",
      cell: (it) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-gray-50">
            {it.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Package className="h-4 w-4 text-gray-300" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-gray-900">{it.name}</div>
            <div className="text-xs capitalize text-gray-400 flex flex-wrap items-center gap-1.5">
              <span>{it.type}</span>
              <span>·</span>
              <span>{it.unit}</span>
              {it.itemCode && (
                <>
                  <span>·</span>
                  <span>{it.itemCode}</span>
                </>
              )}
              {it.categoryName && (
                <>
                  <span>·</span>
                  <span className="rounded bg-blue-50 px-1 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-950/20 dark:text-blue-400">
                    {it.categoryName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "hsn",
      header: "HSN/SAC",
      cell: (it) => <span className="text-sm text-gray-600">{it.hsnSac ?? "—"}</span>,
    },
    {
      key: "price",
      header: "Sale price",
      align: "right",
      cell: (it) => (
        <span className="font-medium tabular-nums text-gray-900">{formatINR(it.salePrice)}</span>
      ),
    },
    {
      key: "gst",
      header: "GST",
      align: "center",
      cell: (it) => (
        <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-50">
          {it.taxRate}%
        </Badge>
      ),
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      cell: (it) => {
        if (it.type === "service") return <span className="text-sm text-gray-400">—</span>;
        const low = it.currentStock <= it.minStock && it.minStock > 0;
        return (
          <span className={`text-sm tabular-nums ${low ? "font-semibold text-red-500" : "text-gray-700"}`}>
            {it.currentStock}
            {low && <span className="ml-1 text-xs">low</span>}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (it) => <ItemActions item={it} onDelete={() => remove.mutate(it.id)} />,
    },
  ];

  const filteredRows = items
    ? items.filter((row) => {
        const isRaw =
          row.categoryName?.toLowerCase().includes("raw") ||
          row.itemCode?.startsWith("RM-");
        if (rawOnly) {
          return isRaw;
        }
        return !isRaw;
      })
    : [];

  return (
    <main className="mx-auto max-w-[1600px] px-4 sm:px-6 py-6 sm:py-10">
      <PageHeader
        title={rawOnly ? "Raw Items" : "Product List"}
        description={`${filteredRows?.length ?? 0} ${rawOnly ? "raw materials" : "products & services"}`}
        backHref="/"
        backLabel="Dashboard"
      />

      <DataTable
        columns={columns}
        rows={filteredRows}
        getRowKey={(it) => it.id}
        isLoading={isLoading}
        error={error}
        emptyMessage={
          rawOnly
            ? "No raw materials found. Add an item and select the 'Raw Material' category to see it here."
            : "No items yet. Add your first product to get started."
        }
      />
    </main>
  );
}

export default function ItemsPage() {
  return (
    <Suspense fallback={null}>
      <ItemsList />
    </Suspense>
  );
}
