"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { ImportWizard } from "../../components/import-wizard";
import { Button } from "@/components/ui/button";

export default function BackupPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wizard, setWizard] = useState<"parties" | "items" | null>(null);

  const download = async () => {
    setBusy(true);
    const data = await api.get("/api/backup");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leafx-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setBusy(false);
  };

  const onFile = async (file: File) => {
    setBusy(true);
    setMsg(null);
    try {
      const parsed = JSON.parse(await file.text());
      const body = { parties: parsed.parties ?? [], items: parsed.items ?? [] };
      const r = await api.post<{ partiesImported: number; itemsImported: number; partiesSkipped: number; itemsSkipped: number }>("/api/backup/import", body);
      setMsg(`Imported ${r.partiesImported} parties (${r.partiesSkipped} skipped) and ${r.itemsImported} items (${r.itemsSkipped} skipped).`);
    } catch {
      setMsg("Could not read that file. Expecting a JSON with `parties` and/or `items` arrays.");
    }
    setBusy(false);
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <header className="mb-8"><Link href="/" className="text-sm text-green-700 hover:underline">← Invoixe</Link>
        <h1 className="text-2xl font-extrabold text-gray-900">Backup &amp; Import</h1></header>

      <section className="mb-6 rounded-xl border border-green-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Backup</h2>
        <p className="mb-3 text-sm text-gray-500">Download a full JSON snapshot of this firm — parties, items, transactions, stock, and bank.</p>
        <button onClick={download} disabled={busy} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
          {busy ? "Preparing…" : "Download backup"}
        </button>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Import parties &amp; items</h2>
        <p className="mb-3 text-sm text-gray-500">Upload a JSON file with <code>parties</code> and/or <code>items</code> arrays (a backup file works too — masters are imported).</p>
        <input type="file" accept="application/json" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} className="text-sm" />
        {msg && <p className="mt-3 text-sm text-green-700">{msg}</p>}
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Import from CSV</h2>
        <p className="mb-3 text-sm text-gray-500">A guided wizard: upload a CSV, map its columns, preview, then import. Ideal for spreadsheets exported from Excel.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setWizard("parties")}>Import Parties (CSV)</Button>
          <Button variant="outline" onClick={() => setWizard("items")}>Import Items (CSV)</Button>
        </div>
      </section>

      {wizard && (
        <ImportWizard entity={wizard} open={!!wizard} onOpenChange={(o) => !o && setWizard(null)} />
      )}
    </main>
  );
}
