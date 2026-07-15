"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { rupeesToPaise } from "@invoixe/core";
import { api } from "../lib/api";
import { parseCsv } from "../lib/csv";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Kind = "string" | "money" | "number";
export type FieldDef = { key: string; label: string; required?: boolean; kind?: Kind };

const PARTY_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", required: true },
  { key: "type", label: "Type (customer/supplier/both)" },
  { key: "phone", label: "Phone" },
  { key: "gstin", label: "GSTIN" },
  { key: "groupName", label: "Group" },
  { key: "openingBalance", label: "Opening balance (₹)", kind: "money" },
];
const ITEM_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", required: true },
  { key: "type", label: "Type (product/service)" },
  { key: "hsnSac", label: "HSN/SAC" },
  { key: "unit", label: "Unit" },
  { key: "itemCode", label: "Item code" },
  { key: "salePrice", label: "Sale price (₹)", kind: "money" },
  { key: "purchasePrice", label: "Purchase price (₹)", kind: "money" },
  { key: "taxRate", label: "GST %", kind: "number" },
  { key: "openingStock", label: "Opening stock", kind: "number" },
];

const NONE = "__none__";

export function ImportWizard({ entity, open, onOpenChange }: { entity: "parties" | "items"; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const fields = entity === "parties" ? PARTY_FIELDS : ITEM_FIELDS;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<string, string>>({}); // fieldKey -> header

  const reset = () => { setStep(1); setHeaders([]); setRows([]); setMap({}); };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then((text) => {
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        toast.error("CSV needs a header row and at least one data row.");
        return;
      }
      const hdr = parsed[0]!.map((h) => h.trim());
      setHeaders(hdr);
      setRows(parsed.slice(1));
      // auto-map fields whose label/key case-insensitively matches a header
      const auto: Record<string, string> = {};
      for (const f of fields) {
        const hit = hdr.find((h) => h.toLowerCase() === f.key.toLowerCase() || h.toLowerCase() === f.label.toLowerCase().split(" ")[0]);
        if (hit) auto[f.key] = hit;
      }
      setMap(auto);
      setStep(2);
    });
  };

  // Build normalized objects from the mapping (applying money/number transforms).
  const records = useMemo(() => {
    const idx: Record<string, number> = {};
    headers.forEach((h, i) => (idx[h] = i));
    return rows.map((r) => {
      const obj: Record<string, unknown> = {};
      for (const f of fields) {
        const header = map[f.key];
        if (!header || header === NONE) continue;
        const raw = (r[idx[header]!] ?? "").trim();
        if (raw === "") continue;
        if (f.kind === "money") obj[f.key] = rupeesToPaise(Number(raw) || 0);
        else if (f.kind === "number") obj[f.key] = Number(raw) || 0;
        else if (f.key === "gstin") obj[f.key] = raw.toUpperCase();
        else obj[f.key] = raw;
      }
      return obj;
    });
  }, [rows, headers, map, fields]);

  const validCount = records.filter((o) => typeof o.name === "string" && (o.name as string).length > 0).length;

  const doImport = useMutation({
    mutationFn: () => api.post<{ partiesImported: number; itemsImported: number; partiesSkipped: number; itemsSkipped: number }>(
      "/api/backup/import",
      entity === "parties" ? { parties: records } : { items: records }
    ),
    onSuccess: (res) => {
      const imported = entity === "parties" ? res.partiesImported : res.itemsImported;
      const skipped = entity === "parties" ? res.partiesSkipped : res.itemsSkipped;
      qc.invalidateQueries({ queryKey: [entity] });
      toast.success(`Imported ${imported} ${entity} (${skipped} skipped)`);
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  const nameMapped = !!map["name"] && map["name"] !== NONE;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import {entity} from CSV — step {step} of 3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 py-4">
            <div
              className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-gray-300 p-10 text-gray-500 hover:border-green-500"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-8 w-8" />
              <span className="text-sm">Click to choose a CSV file</span>
              <span className="text-xs text-gray-400">First row must be column headers.</span>
            </div>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 py-2">
            <p className="text-xs text-gray-500">Map your CSV columns to fields. Unmapped fields are skipped.</p>
            <div className="grid max-h-[50vh] gap-2 overflow-y-auto pr-1">
              {fields.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <Label className="text-sm">
                    {f.label}
                    {f.required && <span className="ml-0.5 text-red-500">*</span>}
                  </Label>
                  <Select value={map[f.key] ?? NONE} onValueChange={(v) => setMap((m) => ({ ...m, [f.key]: v }))}>
                    <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— skip —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
              <Button onClick={() => setStep(3)} disabled={!nameMapped} className="gap-1">Preview<ArrowRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 py-2">
            <p className="text-xs text-gray-500">
              {validCount} of {records.length} rows have a name and will be imported. Rows failing server validation are skipped.
            </p>
            <div className="max-h-[45vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {fields.filter((f) => map[f.key] && map[f.key] !== NONE).map((f) => (
                      <TableHead key={f.key}>{f.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.slice(0, 20).map((rec, i) => (
                    <TableRow key={i}>
                      {fields.filter((f) => map[f.key] && map[f.key] !== NONE).map((f) => (
                        <TableCell key={f.key} className="text-sm">{String(rec[f.key] ?? "")}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-1"><ArrowLeft className="h-4 w-4" />Back</Button>
              <Button onClick={() => doImport.mutate()} disabled={validCount === 0 || doImport.isPending} className="gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {doImport.isPending ? "Importing…" : `Import ${validCount}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
