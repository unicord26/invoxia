"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Save, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { computeInvoice, formatINR, rupeesToPaise, type Paise } from "@invoixe/core";
import { GST_RATES, type Item, type Party } from "@invoixe/types";
import { api } from "../../../lib/api";
import { PageHeader } from "../../../components/page-header";
import { Combobox, type ComboOption } from "../../../components/combobox";
import { MoneyInput } from "../../../components/money-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Business = { id: string; name: string; stateCode: string | null };

type LineRow = {
  itemId: string | null;
  description: string;
  hsnSac: string;
  qty: string;
  rateRupees: string;
  taxRate: number;
};
type ChargeRow = { label: string; amount: Paise | null };

const blankLine: LineRow = { itemId: null, description: "", hsnSac: "", qty: "1", rateRupees: "", taxRate: 18 };

export default function NewInvoicePage() {
  const router = useRouter();
  const { data: parties } = useQuery({ queryKey: ["parties"], queryFn: () => api.get<Party[]>("/api/parties") });
  const { data: items } = useQuery({ queryKey: ["items"], queryFn: () => api.get<Item[]>("/api/items") });
  const { data: business } = useQuery({
    queryKey: ["business"],
    queryFn: () => api.get<Business>("/api/business/current"),
  });

  const [partyId, setPartyId] = useState<string>("");
  const [lines, setLines] = useState<LineRow[]>([{ ...blankLine }]);

  // "More options" (transaction extras)
  const [discountFlat, setDiscountFlat] = useState<Paise | null>(null);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [tcsRate, setTcsRate] = useState("");
  const [tdsRate, setTdsRate] = useState("");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [ewayBillNo, setEwayBillNo] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [transportDistanceKm, setTransportDistanceKm] = useState("");
  const [termsConditions, setTermsConditions] = useState("");

  const party = parties?.find((p) => p.id === partyId) ?? null;
  const sellerState = business?.stateCode ?? "27";
  const buyerState = party?.stateCode ?? sellerState;
  const interState = !!party?.stateCode && party.stateCode !== sellerState;

  const partyOptions: ComboOption[] = (parties ?? []).map((p) => ({ value: p.id, label: p.name, hint: p.gstin ?? undefined }));
  const itemOptions: ComboOption[] = (items ?? []).map((it) => ({ value: it.id, label: it.name, hint: formatINR(it.salePrice) }));

  const adjustments = useMemo(
    () => ({
      discountFlat: discountFlat ?? 0,
      additionalCharges: charges
        .filter((c) => c.label.trim() && c.amount)
        .map((c) => ({ label: c.label.trim(), amount: c.amount! })),
      tcsRate: Number(tcsRate) || 0,
      tdsRate: Number(tdsRate) || 0,
    }),
    [discountFlat, charges, tcsRate, tdsRate]
  );

  // Live totals via the shared tax engine (same code the server uses).
  const computed = useMemo(() => {
    const engineLines = lines
      .filter((l) => Number(l.qty) > 0 && l.rateRupees !== "")
      .map((l) => ({
        qty: Number(l.qty),
        rate: rupeesToPaise(Number(l.rateRupees)),
        taxRate: l.taxRate,
        hsnSac: l.hsnSac || undefined,
      }));
    if (engineLines.length === 0) return null;
    return computeInvoice({ sellerStateCode: sellerState, buyerStateCode: buyerState, lines: engineLines, adjustments });
  }, [lines, sellerState, buyerState, adjustments]);

  const save = useMutation({
    mutationFn: () =>
      api.post<{ id: string }>("/api/invoices", {
        partyId: partyId || null,
        lines: lines
          .filter((l) => Number(l.qty) > 0 && l.rateRupees !== "" && l.description.trim())
          .map((l) => ({
            itemId: l.itemId,
            description: l.description.trim(),
            hsnSac: l.hsnSac || null,
            qty: Number(l.qty),
            rate: rupeesToPaise(Number(l.rateRupees)),
            taxRate: l.taxRate,
          })),
        discountFlat: adjustments.discountFlat,
        additionalCharges: adjustments.additionalCharges,
        tcsRate: adjustments.tcsRate,
        tdsRate: adjustments.tdsRate,
        reverseCharge,
        ewayBillNo: ewayBillNo.trim() || null,
        transporterName: transporterName.trim() || null,
        vehicleNo: vehicleNo.trim() || null,
        transportDistanceKm: transportDistanceKm ? Number(transportDistanceKm) : null,
        termsConditions: termsConditions.trim() || null,
      }),
    onSuccess: (inv) => {
      toast.success("Invoice saved");
      router.push(`/invoices/${inv.id}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save invoice"),
  });

  function updateLine(i: number, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function pickItem(i: number, itemId: string) {
    const it = items?.find((x) => x.id === itemId);
    if (!it) return updateLine(i, { itemId: null, description: "" });
    updateLine(i, {
      itemId: it.id,
      description: it.name,
      hsnSac: it.hsnSac ?? "",
      rateRupees: (it.salePrice / 100).toString(),
      taxRate: it.taxRate,
    });
  }

  const canSave =
    lines.some((l) => Number(l.qty) > 0 && l.rateRupees !== "" && l.description.trim()) && !save.isPending;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader title="New Sale Invoice" backHref="/invoices" backLabel="Invoices" />

      {/* Party */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <Label className="mb-1.5 block text-xs font-medium text-gray-600">Bill to (party)</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Combobox
              options={partyOptions}
              value={partyId}
              onChange={setPartyId}
              placeholder="Cash sale (no party)"
              searchPlaceholder="Search parties…"
              emptyText="No parties found."
              className="max-w-md"
            />
            <Badge variant={interState ? "default" : "secondary"}>
              {interState ? "Inter-state → IGST" : "Intra-state → CGST + SGST"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Lines */}
      <Card className="mb-6 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="min-w-[240px]">Item / description</TableHead>
                <TableHead className="w-28">HSN</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-28">Rate ₹</TableHead>
                <TableHead className="w-24">GST</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, i) => {
                const amt = computeInvoice({
                  sellerStateCode: sellerState,
                  buyerStateCode: buyerState,
                  lines: [{ qty: Number(l.qty) || 0, rate: rupeesToPaise(Number(l.rateRupees) || 0), taxRate: l.taxRate }],
                }).lines[0]!;
                return (
                  <TableRow key={i}>
                    <TableCell className="align-top">
                      {itemOptions.length > 0 && (
                        <div className="mb-1.5">
                          <Combobox
                            options={itemOptions}
                            value={l.itemId ?? ""}
                            onChange={(v) => pickItem(i, v)}
                            placeholder="Pick item…"
                            searchPlaceholder="Search items…"
                            emptyText="No items."
                          />
                        </div>
                      )}
                      <Input
                        value={l.description}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                        placeholder="Description"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input value={l.hsnSac} onChange={(e) => updateLine(i, { hsnSac: e.target.value })} className="w-24" />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input type="number" step="any" value={l.qty} onChange={(e) => updateLine(i, { qty: e.target.value })} className="w-20" />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input type="number" step="0.01" value={l.rateRupees} onChange={(e) => updateLine(i, { rateRupees: e.target.value })} className="w-24" />
                    </TableCell>
                    <TableCell className="align-top">
                      <Select value={String(l.taxRate)} onValueChange={(v) => updateLine(i, { taxRate: Number(v) })}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GST_RATES.map((r) => (
                            <SelectItem key={r} value={String(r)}>
                              {r}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right align-top font-medium tabular-nums text-gray-900">
                      {formatINR(amt.lineTotal)}
                    </TableCell>
                    <TableCell className="align-top">
                      {lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-600"
                          onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                          aria-label="Remove line"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="p-3">
          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-green-700" onClick={() => setLines((prev) => [...prev, { ...blankLine }])}>
            <Plus className="h-4 w-4" />
            Add line
          </Button>
        </div>
      </Card>

      {/* More options (transaction extras) */}
      <Collapsible className="mb-6">
        <Card>
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between p-4 text-sm font-semibold text-gray-700 [&[data-state=open]>svg]:rotate-180">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-green-600" />
                More options — charges, e-way bill, TCS/TDS, terms
              </span>
              <ChevronDown className="h-4 w-4 transition-transform" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="grid gap-5 border-t pt-4 md:grid-cols-2">
              {/* Discount + charges */}
              <div className="space-y-3">
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-gray-600">Flat discount (post-tax)</Label>
                  <MoneyInput value={discountFlat} onChange={setDiscountFlat} />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <Label className="text-xs font-medium text-gray-600">Additional charges</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-green-700" onClick={() => setCharges((c) => [...c, { label: "", amount: null }])}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {charges.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          placeholder="e.g. Freight"
                          value={c.label}
                          onChange={(e) => setCharges((prev) => prev.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                        />
                        <div className="w-32 shrink-0">
                          <MoneyInput
                            value={c.amount}
                            onChange={(v) => setCharges((prev) => prev.map((x, idx) => (idx === i ? { ...x, amount: v } : x)))}
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-600" onClick={() => setCharges((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove charge">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {charges.length === 0 && <p className="text-xs text-gray-400">No extra charges.</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-gray-600">TCS %</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0" value={tcsRate} onChange={(e) => setTcsRate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-gray-600">TDS %</Label>
                    <Input type="number" step="0.01" min="0" placeholder="0" value={tdsRate} onChange={(e) => setTdsRate(e.target.value)} />
                  </div>
                </div>
                <label className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm font-medium text-gray-700">Reverse charge applicable</span>
                  <Switch checked={reverseCharge} onCheckedChange={setReverseCharge} />
                </label>
              </div>

              {/* Transport + terms */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-gray-600">E-way bill no.</Label>
                    <Input value={ewayBillNo} onChange={(e) => setEwayBillNo(e.target.value)} placeholder="Optional" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-gray-600">Distance (km)</Label>
                    <Input type="number" min="0" value={transportDistanceKm} onChange={(e) => setTransportDistanceKm(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-gray-600">Transporter</Label>
                    <Input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} placeholder="Optional" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-gray-600">Vehicle no.</Label>
                    <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="Optional" />
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-gray-600">Terms &amp; conditions</Label>
                  <Textarea rows={4} value={termsConditions} onChange={(e) => setTermsConditions(e.target.value)} placeholder="Payment terms, warranty, etc." />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Totals + save */}
      <div className="flex flex-col items-end gap-4">
        <Card className="w-full max-w-xs">
          <CardContent className="p-4 text-sm">
            <Row label="Taxable" value={computed ? formatINR(computed.totals.subTotal) : "—"} />
            {computed?.interState ? (
              <Row label="IGST" value={formatINR(computed.totals.igst)} />
            ) : (
              <>
                <Row label="CGST" value={computed ? formatINR(computed.totals.cgst) : "—"} />
                <Row label="SGST" value={computed ? formatINR(computed.totals.sgst) : "—"} />
              </>
            )}
            {computed && computed.totals.discountFlat > 0 && (
              <Row label="Discount" value={`− ${formatINR(computed.totals.discountFlat)}`} />
            )}
            {computed && computed.totals.additionalCharges > 0 && (
              <Row label="Additional charges" value={formatINR(computed.totals.additionalCharges)} />
            )}
            {computed && computed.totals.tcsAmount > 0 && (
              <Row label={`TCS @ ${computed.totals.tcsRate}%`} value={formatINR(computed.totals.tcsAmount)} />
            )}
            {computed && computed.totals.tdsAmount > 0 && (
              <Row label={`TDS @ ${computed.totals.tdsRate}%`} value={`− ${formatINR(computed.totals.tdsAmount)}`} />
            )}
            {computed && computed.totals.roundOff !== 0 && (
              <Row label="Round off" value={formatINR(computed.totals.roundOff)} />
            )}
            <div className="mt-2 flex justify-between border-t border-gray-100 pt-2 text-base font-extrabold text-green-700">
              <span>Grand Total</span>
              <span className="tabular-nums">{computed ? formatINR(computed.totals.grandTotal) : "₹0.00"}</span>
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => save.mutate()} disabled={!canSave} size="lg" className="gap-1.5">
          <Save className="h-4 w-4" />
          {save.isPending ? "Saving…" : "Save invoice"}
        </Button>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-gray-600">
      <span>{label}</span>
      <span className="font-medium tabular-nums text-gray-900">{value}</span>
    </div>
  );
}
