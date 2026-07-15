"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@invoixe/core";
import type { ChequeStatus } from "@invoixe/types";
import { api } from "../../../lib/api";
import { PageHeader } from "../../../components/page-header";
import { DataTable, type Column } from "../../../components/data-table";
import { MoneyInput } from "../../../components/money-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Cheque = {
  id: string; chequeNo: string; amount: number; direction: "received" | "issued";
  status: ChequeStatus; date: string; dueDate: string | null; notes: string | null;
};

const STATUS_STYLE: Record<ChequeStatus, string> = {
  open: "bg-amber-50 text-amber-700",
  deposited: "bg-blue-50 text-blue-700",
  cleared: "bg-green-100 text-green-700",
  bounced: "bg-red-50 text-red-700",
};

const formSchema = z.object({
  chequeNo: z.string().trim().min(1, "Cheque no. required"),
  amount: z.number().int().positive().nullable(),
  direction: z.enum(["received", "issued"]),
  dueDate: z.string(),
  notes: z.string(),
});
type FormValues = z.infer<typeof formSchema>;
const DEFAULTS: FormValues = { chequeNo: "", amount: null, direction: "received", dueDate: "", notes: "" };

function AddChequeDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: DEFAULTS });

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      api.post<Cheque>("/api/cheques", {
        chequeNo: v.chequeNo.trim(),
        amount: v.amount ?? 0,
        direction: v.direction,
        dueDate: v.dueDate || null,
        notes: v.notes.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cheques"] });
      toast.success("Cheque added");
      form.reset(DEFAULTS);
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add cheque"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) form.reset(DEFAULTS); }}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="h-4 w-4" />Add Cheque</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add a cheque</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="chequeNo" render={({ field }) => (
              <FormItem><FormLabel>Cheque no.</FormLabel><FormControl><Input placeholder="000123" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="direction" render={({ field }) => (
              <FormItem>
                <FormLabel>Direction</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="issued">Issued</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem><FormLabel>Amount</FormLabel><FormControl><MoneyInput value={field.value} onChange={field.onChange} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="dueDate" render={({ field }) => (
              <FormItem><FormLabel>Due date</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem className="sm:col-span-2"><FormLabel>Notes</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl></FormItem>
            )} />
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Add cheque"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function ChequesPage() {
  const qc = useQueryClient();
  const { data: cheques, isLoading, error } = useQuery({
    queryKey: ["cheques"],
    queryFn: () => api.get<Cheque[]>("/api/cheques"),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: ChequeStatus }) => api.patch(`/api/cheques/${v.id}/status`, { status: v.status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cheques"] }); toast.success("Status updated"); },
    onError: () => toast.error("Could not update status"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/cheques/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cheques"] }); toast.success("Cheque deleted"); },
  });

  const columns: Column<Cheque>[] = [
    { key: "no", header: "Cheque no.", cell: (c) => <span className="font-medium text-gray-900">{c.chequeNo}</span> },
    { key: "dir", header: "Direction", cell: (c) => <Badge variant="secondary" className="capitalize">{c.direction}</Badge> },
    { key: "due", header: "Due date", cell: (c) => <span className="text-sm text-gray-600">{c.dueDate ? new Date(c.dueDate).toLocaleDateString() : "—"}</span> },
    { key: "status", header: "Status", cell: (c) => <Badge className={`${STATUS_STYLE[c.status]} capitalize hover:${STATUS_STYLE[c.status]}`}>{c.status}</Badge> },
    { key: "amount", header: "Amount", align: "right", cell: (c) => <span className="font-semibold tabular-nums text-gray-900">{formatINR(c.amount)}</span> },
    {
      key: "actions", header: "", align: "right",
      cell: (c) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {c.status !== "deposited" && <DropdownMenuItem onClick={() => setStatus.mutate({ id: c.id, status: "deposited" })}>Mark deposited</DropdownMenuItem>}
            {c.status !== "cleared" && <DropdownMenuItem onClick={() => setStatus.mutate({ id: c.id, status: "cleared" })}>Mark cleared</DropdownMenuItem>}
            {c.status !== "bounced" && <DropdownMenuItem onClick={() => setStatus.mutate({ id: c.id, status: "bounced" })}>Mark bounced</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => remove.mutate(c.id)}>
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader title="Cheques" description={`${cheques?.length ?? 0} cheques tracked`} backHref="/bank" backLabel="Cash & Bank">
        <AddChequeDialog />
      </PageHeader>
      <DataTable columns={columns} rows={cheques} getRowKey={(c) => c.id} isLoading={isLoading} error={error} emptyMessage="No cheques yet." />
    </main>
  );
}
