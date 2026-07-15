"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@invoixe/core";
import type { LoanEntryKind } from "@invoixe/types";
import { api } from "../../../lib/api";
import { PageHeader } from "../../../components/page-header";
import { MoneyInput } from "../../../components/money-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Entry = { id: string; amount: number; kind: LoanEntryKind; date: string; note: string | null };
type Loan = {
  id: string; lender: string; principal: number; balance: number;
  interestRate: number | null; startDate: string; notes: string | null; entries: Entry[];
};

/* -------- Add loan -------- */
const loanSchema = z.object({
  lender: z.string().trim().min(1, "Lender required"),
  principal: z.number().int().nonnegative().nullable(),
  interestRate: z.string(),
  notes: z.string(),
});
type LoanForm = z.infer<typeof loanSchema>;
const LOAN_DEFAULTS: LoanForm = { lender: "", principal: null, interestRate: "", notes: "" };

function AddLoanDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<LoanForm>({ resolver: zodResolver(loanSchema), defaultValues: LOAN_DEFAULTS });

  const create = useMutation({
    mutationFn: (v: LoanForm) =>
      api.post<Loan>("/api/loans", {
        lender: v.lender.trim(),
        principal: v.principal ?? 0,
        interestRate: v.interestRate ? Number(v.interestRate) : null,
        notes: v.notes.trim() || null,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loans"] }); toast.success("Loan added"); form.reset(LOAN_DEFAULTS); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add loan"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) form.reset(LOAN_DEFAULTS); }}>
      <DialogTrigger asChild><Button className="gap-1.5"><Plus className="h-4 w-4" />Add Loan</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add a loan account</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="lender" render={({ field }) => (
              <FormItem className="sm:col-span-2"><FormLabel>Lender</FormLabel><FormControl><Input placeholder="e.g. HDFC Bank" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="principal" render={({ field }) => (
              <FormItem><FormLabel>Principal</FormLabel><FormControl><MoneyInput value={field.value} onChange={field.onChange} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="interestRate" render={({ field }) => (
              <FormItem><FormLabel>Interest %</FormLabel><FormControl><Input type="number" step="0.01" min="0" placeholder="0" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem className="sm:col-span-2"><FormLabel>Notes</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl></FormItem>
            )} />
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Add loan"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/* -------- Add entry -------- */
const entrySchema = z.object({
  amount: z.number().int().positive().nullable(),
  kind: z.enum(["disbursement", "emi", "charge"]),
  note: z.string(),
});
type EntryForm = z.infer<typeof entrySchema>;

function AddEntryDialog({ loan }: { loan: Loan }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<EntryForm>({ resolver: zodResolver(entrySchema), defaultValues: { amount: null, kind: "emi", note: "" } });

  const create = useMutation({
    mutationFn: (v: EntryForm) => api.post(`/api/loans/${loan.id}/entries`, { amount: v.amount ?? 0, kind: v.kind, note: v.note.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loans"] }); toast.success("Entry recorded"); form.reset({ amount: null, kind: "emi", note: "" }); setOpen(false); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not record entry"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" />Entry</Button></DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Record entry — {loan.lender}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="kind" render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="emi">EMI (reduces balance)</SelectItem>
                    <SelectItem value="disbursement">Disbursement (adds)</SelectItem>
                    <SelectItem value="charge">Charge / interest (adds)</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem><FormLabel>Amount</FormLabel><FormControl><MoneyInput value={field.value} onChange={field.onChange} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="note" render={({ field }) => (
              <FormItem><FormLabel>Note</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Record"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function LoansPage() {
  const qc = useQueryClient();
  const { data: loans, isLoading, error } = useQuery({ queryKey: ["loans"], queryFn: () => api.get<Loan[]>("/api/loans") });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/loans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loans"] }); toast.success("Loan deleted"); },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader title="Loan Accounts" description={`${loans?.length ?? 0} loans`} backHref="/bank" backLabel="Cash & Bank">
        <AddLoanDialog />
      </PageHeader>

      {isLoading && <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}
      {error && <p className="text-sm text-red-600">Failed to load loans.</p>}
      {loans && loans.length === 0 && (
        <Card><CardContent className="p-10 text-center text-sm text-gray-500">No loans yet. Add your first loan account.</CardContent></Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {loans?.map((loan) => (
          <Card key={loan.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">{loan.lender}</h3>
                  <p className="text-xs text-gray-500">
                    Principal {formatINR(loan.principal)}
                    {loan.interestRate != null && <> · {loan.interestRate}% p.a.</>}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => remove.mutate(loan.id)} aria-label="Delete loan">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-green-600" />
                <span className="text-xl font-bold text-gray-900">{formatINR(loan.balance)}</span>
                <Badge variant="secondary" className="ml-1">outstanding</Badge>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Entries</span>
                <AddEntryDialog loan={loan} />
              </div>
              <ul className="mt-2 space-y-1">
                {loan.entries.length === 0 && <li className="text-xs text-gray-400">No entries yet.</li>}
                {loan.entries.slice(0, 5).map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-gray-600">
                      {e.kind}
                      {e.note && <span className="text-gray-400"> · {e.note}</span>}
                    </span>
                    <span className={`tabular-nums font-medium ${e.kind === "emi" ? "text-green-600" : "text-gray-700"}`}>
                      {e.kind === "emi" ? "−" : "+"} {formatINR(e.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
