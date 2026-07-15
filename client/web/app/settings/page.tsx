"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BusinessSettings } from "@invoixe/types";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/page-header";
import { ImageUpload } from "../../components/image-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ---------- small building blocks ---------- */

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <p className="text-sm font-medium text-gray-800">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ---------- business profile ---------- */

type Business = {
  id: string;
  name: string;
  gstin: string | null;
  pan: string | null;
  stateCode: string | null;
  stateName: string | null;
  address: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  jurisdiction: string | null;
  businessCategory: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  bankBranch: string | null;
};

const PROFILE_FIELDS: { key: keyof Business; label: string; ph?: string; section: "Firm" | "Bank" }[] = [
  { key: "name", label: "Business name", ph: "My Business", section: "Firm" },
  { key: "gstin", label: "GSTIN/UIN", ph: "27ABGFA0472K1ZF", section: "Firm" },
  { key: "pan", label: "PAN", ph: "ABGFA0472K", section: "Firm" },
  { key: "stateCode", label: "State code", ph: "27", section: "Firm" },
  { key: "stateName", label: "State", ph: "Maharashtra", section: "Firm" },
  { key: "phone", label: "Phone", ph: "9049484236", section: "Firm" },
  { key: "email", label: "Email", ph: "billing@firm.com", section: "Firm" },
  { key: "businessCategory", label: "Category", ph: "Manufacturer", section: "Firm" },
  { key: "jurisdiction", label: "Jurisdiction", ph: "Palghar", section: "Firm" },
  { key: "pincode", label: "Pincode", ph: "401501", section: "Firm" },
  { key: "address", label: "Address", ph: "Shed no…, Boisar", section: "Firm" },
  { key: "bankName", label: "Bank name", ph: "RBL Bank", section: "Bank" },
  { key: "bankAccountNo", label: "Account no.", ph: "409000505463", section: "Bank" },
  { key: "bankIfsc", label: "IFSC", ph: "RATN0000107", section: "Bank" },
  { key: "bankBranch", label: "Branch", ph: "Boisar", section: "Bank" },
];

function ProfileTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["business"], queryFn: () => api.get<Business>("/api/business/current") });
  const [form, setForm] = useState<Record<string, string>>({});
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const f: Record<string, string> = {};
    for (const { key } of PROFILE_FIELDS) f[key] = (data[key] as string | null) ?? "";
    setForm(f);
    setLogoUrl(data.logoUrl);
    setSignatureUrl(data.signatureUrl);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.patch<Business>("/api/business/current", { ...form, logoUrl, signatureUrl }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business"] });
      toast.success("Business profile saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="space-y-6"
    >
      {/* Branding */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-green-700">Branding</h3>
        <div className="flex flex-wrap gap-8">
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-gray-600">Company logo</Label>
            {data && (
              <ImageUpload value={logoUrl} onChange={setLogoUrl} pathPrefix={`logos/${data.id}`} />
            )}
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-gray-600">Signature</Label>
            {data && (
              <ImageUpload value={signatureUrl} onChange={setSignatureUrl} pathPrefix={`signatures/${data.id}`} shape="wide" />
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">Shown on printed invoices when enabled in Print preferences.</p>
      </div>

      {(["Firm", "Bank"] as const).map((section) => (
        <div key={section}>
          <h3 className="mb-3 text-sm font-semibold text-green-700">{section} details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROFILE_FIELDS.filter((f) => f.section === section).map((f) => (
              <div key={f.key} className={f.key === "address" ? "sm:col-span-2" : ""}>
                <Label className="mb-1 block text-xs font-medium text-gray-600">{f.label}</Label>
                <Input
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.ph}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

/* ---------- numbering ---------- */

type Series = { key: string; label: string; prefix: string; next: number };

function NumberingTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["series"], queryFn: () => api.get<Series[]>("/api/business/current/series") });
  const [edits, setEdits] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (v: { key: string; prefix: string }) => api.patch("/api/business/current/series", v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["series"] });
      toast.success("Prefix updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update prefix"),
  });

  return (
    <div className="space-y-1">
      <p className="mb-3 text-xs text-gray-500">
        The prefix is combined with a running number, e.g. <code>INV-42</code>. Changing it affects future documents only.
      </p>
      {data?.map((s) => {
        const val = edits[s.key] ?? s.prefix;
        const dirty = val !== s.prefix;
        return (
          <div key={s.key} className="flex items-center justify-between gap-4 border-b py-2.5 last:border-b-0">
            <div>
              <p className="text-sm font-medium text-gray-800">{s.label}</p>
              <p className="text-xs text-gray-500">
                Next: <code>{val}-{s.next}</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={val}
                onChange={(e) => setEdits((p) => ({ ...p, [s.key]: e.target.value.toUpperCase() }))}
                className="w-28"
              />
              <Button
                size="sm"
                variant={dirty ? "default" : "outline"}
                disabled={!dirty || save.isPending}
                onClick={() => save.mutate({ key: s.key, prefix: val })}
              >
                Save
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- preferences (settings JSON) ---------- */

function PreferencesTabs() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<BusinessSettings>("/api/business/current/settings"),
  });
  const [draft, setDraft] = useState<BusinessSettings | null>(null);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (s: BusinessSettings) => api.patch<BusinessSettings>("/api/business/current/settings", s),
    onSuccess: (s) => {
      qc.setQueryData(["settings"], s);
      toast.success("Preferences saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  if (!draft) return <p className="p-4 text-sm text-gray-500">Loading…</p>;

  // Typed group updater: set(group, key, value).
  function set<G extends keyof BusinessSettings, K extends keyof BusinessSettings[G]>(
    group: G,
    key: K,
    value: BusinessSettings[G][K]
  ) {
    setDraft((d) => (d ? { ...d, [group]: { ...d[group], [key]: value } } : d));
  }
  function setNested<
    G extends keyof BusinessSettings,
    S extends keyof BusinessSettings[G],
    K extends keyof BusinessSettings[G][S]
  >(group: G, sub: S, key: K, value: BusinessSettings[G][S][K]) {
    setDraft((d) =>
      d ? { ...d, [group]: { ...d[group], [sub]: { ...(d[group][sub] as object), [key]: value } } } : d
    );
  }

  const num = (n: number) => String(n);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="general">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="transaction">Transaction</TabsTrigger>
          <TabsTrigger value="taxes">Taxes & GST</TabsTrigger>
          <TabsTrigger value="print">Print</TabsTrigger>
          <TabsTrigger value="party">Party</TabsTrigger>
          <TabsTrigger value="item">Item</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="divide-y">
          <SelectRow label="Amount decimals" value={num(draft.general.amountDecimals)} onChange={(v) => set("general", "amountDecimals", Number(v))} options={[0, 1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} />
          <ToggleRow label="Show GSTIN on documents" checked={draft.general.showGstin} onCheckedChange={(v) => set("general", "showGstin", v)} />
          <ToggleRow label="Block sale on negative stock" description="Prevent billing below available stock." checked={draft.general.stopSaleOnNegativeStock} onCheckedChange={(v) => set("general", "stopSaleOnNegativeStock", v)} />
          <div className="pt-2">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Enabled documents</p>
            <ToggleRow label="Estimate / Quotation" checked={draft.general.enabledDocs.estimate} onCheckedChange={(v) => setNested("general", "enabledDocs", "estimate", v)} />
            <ToggleRow label="Proforma invoice" checked={draft.general.enabledDocs.proforma} onCheckedChange={(v) => setNested("general", "enabledDocs", "proforma", v)} />
            <ToggleRow label="Sale order" checked={draft.general.enabledDocs.saleOrder} onCheckedChange={(v) => setNested("general", "enabledDocs", "saleOrder", v)} />
            <ToggleRow label="Purchase order" checked={draft.general.enabledDocs.purchaseOrder} onCheckedChange={(v) => setNested("general", "enabledDocs", "purchaseOrder", v)} />
            <ToggleRow label="Delivery challan" checked={draft.general.enabledDocs.deliveryChallan} onCheckedChange={(v) => setNested("general", "enabledDocs", "deliveryChallan", v)} />
          </div>
        </TabsContent>

        <TabsContent value="transaction" className="divide-y">
          <ToggleRow label="Show invoice number" checked={draft.transaction.showInvoiceNo} onCheckedChange={(v) => set("transaction", "showInvoiceNo", v)} />
          <ToggleRow label="Prices tax-inclusive by default" checked={draft.transaction.taxInclusiveByDefault} onCheckedChange={(v) => set("transaction", "taxInclusiveByDefault", v)} />
          <ToggleRow label="Round off total" checked={draft.transaction.roundOff.enabled} onCheckedChange={(v) => setNested("transaction", "roundOff", "enabled", v)} />
          <SelectRow label="Round off to" value={num(draft.transaction.roundOff.to)} onChange={(v) => setNested("transaction", "roundOff", "to", Number(v) as 1 | 10 | 100)} options={[{ value: "1", label: "Nearest ₹1" }, { value: "10", label: "Nearest ₹10" }, { value: "100", label: "Nearest ₹100" }]} />
          <ToggleRow label="Due dates & payment terms" checked={draft.transaction.dueDatesAndTerms} onCheckedChange={(v) => set("transaction", "dueDatesAndTerms", v)} />
          <ToggleRow label="E-way bill field" checked={draft.transaction.enableEwayBill} onCheckedChange={(v) => set("transaction", "enableEwayBill", v)} />
          <ToggleRow label="Transportation details" checked={draft.transaction.transportDetails} onCheckedChange={(v) => set("transaction", "transportDetails", v)} />
          <ToggleRow label="Additional charges" checked={draft.transaction.additionalCharges} onCheckedChange={(v) => set("transaction", "additionalCharges", v)} />
        </TabsContent>

        <TabsContent value="taxes" className="divide-y">
          <ToggleRow label="Enable GST" checked={draft.taxes.enableGst} onCheckedChange={(v) => set("taxes", "enableGst", v)} />
          <ToggleRow label="Enable HSN/SAC" checked={draft.taxes.enableHsn} onCheckedChange={(v) => set("taxes", "enableHsn", v)} />
          <ToggleRow label="Additional cess" checked={draft.taxes.additionalCess} onCheckedChange={(v) => set("taxes", "additionalCess", v)} />
          <ToggleRow label="Reverse charge" checked={draft.taxes.reverseCharge} onCheckedChange={(v) => set("taxes", "reverseCharge", v)} />
          <ToggleRow label="Place of supply" checked={draft.taxes.placeOfSupply} onCheckedChange={(v) => set("taxes", "placeOfSupply", v)} />
          <ToggleRow label="Composite scheme" checked={draft.taxes.compositeScheme} onCheckedChange={(v) => set("taxes", "compositeScheme", v)} />
          <ToggleRow label="Enable TCS" checked={draft.taxes.enableTcs} onCheckedChange={(v) => set("taxes", "enableTcs", v)} />
          <ToggleRow label="Enable TDS" checked={draft.taxes.enableTds} onCheckedChange={(v) => set("taxes", "enableTds", v)} />
        </TabsContent>

        <TabsContent value="print" className="divide-y">
          <SelectRow label="Invoice theme" value={draft.print.theme} onChange={(v) => set("print", "theme", v as "tally" | "gst1")} options={[{ value: "tally", label: "Tally (dense)" }, { value: "gst1", label: "GST (spacious)" }]} />
          <ToggleRow label="Show company logo" checked={draft.print.showLogo} onCheckedChange={(v) => set("print", "showLogo", v)} />
          <ToggleRow label="Show GSTIN on sale" checked={draft.print.showGstinOnSale} onCheckedChange={(v) => set("print", "showGstinOnSale", v)} />
          <ToggleRow label="Show received amount" checked={draft.print.showReceivedAmount} onCheckedChange={(v) => set("print", "showReceivedAmount", v)} />
          <ToggleRow label="Show balance amount" checked={draft.print.showBalanceAmount} onCheckedChange={(v) => set("print", "showBalanceAmount", v)} />
          <ToggleRow label="Show tax details" checked={draft.print.showTaxDetails} onCheckedChange={(v) => set("print", "showTaxDetails", v)} />
          <ToggleRow label="Show amount in words" checked={draft.print.showAmountInWords} onCheckedChange={(v) => set("print", "showAmountInWords", v)} />
          <ToggleRow label="Show signature" checked={draft.print.showSignature} onCheckedChange={(v) => set("print", "showSignature", v)} />
        </TabsContent>

        <TabsContent value="party" className="divide-y">
          <ToggleRow label="Shipping address" checked={draft.party.shippingAddress} onCheckedChange={(v) => set("party", "shippingAddress", v)} />
          <ToggleRow label="Manage party status" checked={draft.party.managePartyStatus} onCheckedChange={(v) => set("party", "managePartyStatus", v)} />
          <ToggleRow label="Loyalty points" checked={draft.party.loyaltyPoints} onCheckedChange={(v) => set("party", "loyaltyPoints", v)} />
        </TabsContent>

        <TabsContent value="item" className="divide-y">
          <ToggleRow label="Maintain stock" checked={draft.item.stockMaintenance} onCheckedChange={(v) => set("item", "stockMaintenance", v)} />
          <ToggleRow label="Low-stock alerts" checked={draft.item.showLowStockDialog} onCheckedChange={(v) => set("item", "showLowStockDialog", v)} />
          <ToggleRow label="Item categories" checked={draft.item.itemCategory} onCheckedChange={(v) => set("item", "itemCategory", v)} />
          <ToggleRow label="Wholesale price" checked={draft.item.wholesalePrice} onCheckedChange={(v) => set("item", "wholesalePrice", v)} />
          <ToggleRow label="Item description" checked={draft.item.description} onCheckedChange={(v) => set("item", "description", v)} />
          <ToggleRow label="Item-wise tax" checked={draft.item.itemWiseTax} onCheckedChange={(v) => set("item", "itemWiseTax", v)} />
          <ToggleRow label="Item-wise discount" checked={draft.item.itemWiseDiscount} onCheckedChange={(v) => set("item", "itemWiseDiscount", v)} />
          <SelectRow label="Quantity decimals" value={num(draft.item.qtyDecimals)} onChange={(v) => set("item", "qtyDecimals", Number(v))} options={[0, 1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} />
        </TabsContent>
      </Tabs>

      <Separator />
      <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save preferences"}
      </Button>
    </div>
  );
}

/* ---------- page ---------- */

export default function SettingsPage() {
  const { data: business } = useQuery({ queryKey: ["business"], queryFn: () => api.get<Business>("/api/business/current") });

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <PageHeader title="Settings" description="Firm profile, preferences, and document numbering." backHref="/" backLabel="Dashboard" />

      {business && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <span className="font-semibold text-green-800">Your online store:</span>
            <code className="rounded bg-white px-2 py-1 text-xs text-gray-700">
              {typeof window !== "undefined" ? `${window.location.origin}/store/${business.id}` : ""}
            </code>
            <Button asChild size="sm" variant="outline">
              <Link href={`/store/${business.id}`}>Open</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="profile" className="flex flex-col gap-6 md:flex-row">
        <TabsList className="h-auto flex-row flex-wrap justify-start gap-1 bg-transparent p-0 md:w-48 md:flex-col md:bg-muted md:p-1">
          <TabsTrigger value="profile" className="md:w-full md:justify-start">Business profile</TabsTrigger>
          <TabsTrigger value="preferences" className="md:w-full md:justify-start">Preferences</TabsTrigger>
          <TabsTrigger value="numbering" className="md:w-full md:justify-start">Numbering</TabsTrigger>
        </TabsList>

        <div className="min-w-0 flex-1">
          <TabsContent value="profile" className="mt-0">
            <Card>
              <CardContent className="p-6">
                <ProfileTab />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="preferences" className="mt-0">
            <Card>
              <CardContent className="p-6">
                <PreferencesTabs />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="numbering" className="mt-0">
            <Card>
              <CardContent className="p-6">
                <NumberingTab />
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </main>
  );
}
