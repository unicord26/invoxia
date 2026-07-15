"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatINR, rupeesToPaise, paiseToRupees } from "@invoixe/core";
import { api } from "../../lib/api";
import {
  Landmark,
  Wallet,
  Zap,
  ArrowRight,
  Search,
  Plus,
  Minus,
  ArrowLeftRight,
  Info,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  PlusCircle,
  CreditCard,
  Trash2,
  ShieldCheck
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreditCardForm, type CardState } from "@/components/credit-card-form";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Detect the card network from the leading digits (IIN ranges). Used only to
// derive a display label — we never persist the full number.
function detectNetwork(pan: string): "visa" | "mastercard" | "rupay" | "amex" | "other" {
  const n = pan.replace(/\D/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(60|65|81|82|508)/.test(n)) return "rupay";
  return "other";
}

type Account = {
  id: string;
  name: string;
  type: "bank" | "cash" | "upi" | string;
  accountNo: string | null;
  ifsc: string | null;
  bankName: string | null;
  branch: string | null;
  holderName: string | null;
  upiId: string | null;
  balance: number;
};

type PaymentCard = {
  id: string;
  label: string;
  network: "visa" | "mastercard" | "rupay" | "amex" | "other" | string;
  kind: "debit" | "credit" | string;
  last4: string;
  expiryLabel: string | null;
  holderName: string | null;
};

type BankEntry = {
  id: string;
  accountId: string;
  amount: number;
  kind: "deposit" | "withdraw" | "transfer_in" | "transfer_out" | string;
  note: string | null;
  date: string;
  account: {
    id: string;
    name: string;
    type: string;
  };
};

export default function BankPage() {
  const qc = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("deposit");

  // Form states
  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [accountNo, setAccountNo] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [holderName, setHolderName] = useState("");
  const [upiId, setUpiId] = useState("");
  const [opening, setOpening] = useState("");

  // Card-adding uses the CreditCardForm component inside a dialog. It captures
  // the full PAN + CVV client-side for the visual entry UX, but on submit we
  // derive and persist ONLY the PCI-safe subset (last 4, network, expiry,
  // holder). The full number and CVV are never sent to the backend.
  const [cardDialogOpen, setCardDialogOpen] = useState(false);

  const [depositAmount, setDepositAmount] = useState("");
  const [depositNote, setDepositNote] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");

  const [xfer, setXfer] = useState({ toId: "", amount: "", note: "" });
  const [ledgerSearch, setLedgerSearch] = useState("");

  // API Queries
  const { data: accounts, isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["bank"],
    queryFn: () => api.get<Account[]>("/api/bank"),
  });

  const { data: entries, isLoading: ledgerLoading } = useQuery<BankEntry[]>({
    queryKey: ["bank-entries"],
    queryFn: () => api.get<BankEntry[]>("/api/bank/entries"),
  });

  const { data: cards, isLoading: cardsLoading } = useQuery<PaymentCard[]>({
    queryKey: ["cards"],
    queryFn: () => api.get<PaymentCard[]>("/api/cards"),
  });

  // Auto-select first account if none is selected
  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0]!.id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);

  // Cache invalidator (forces full sync across dashboard & bank datasets)
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["bank"] });
    qc.invalidateQueries({ queryKey: ["bank-entries"] });
    qc.invalidateQueries({ queryKey: ["cards"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["summary"] });
    qc.invalidateQueries({ queryKey: ["daybook"] });
  };

  // Mutations
  const addAcctMutation = useMutation({
    mutationFn: () =>
      api.post("/api/bank", {
        name: name.trim(),
        type,
        accountNo: accountNo.trim() || null,
        ifsc: ifsc.trim() || null,
        bankName: bankName.trim() || null,
        branch: branch.trim() || null,
        holderName: holderName.trim() || null,
        upiId: upiId.trim() || null,
        openingBalance: opening ? rupeesToPaise(Number(opening)) : 0,
      }),
    onSuccess: () => {
      invalidateAll();
      setName("");
      setOpening("");
      setAccountNo("");
      setIfsc("");
      setBankName("");
      setBranch("");
      setHolderName("");
      setUpiId("");
      toast.success("Bank account created successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create account.");
    },
  });

  type CardPayload = {
    label: string;
    network: string;
    kind: string;
    last4: string;
    expiryLabel: string | null;
    holderName: string | null;
  };

  const addCardMutation = useMutation({
    mutationFn: (payload: CardPayload) => api.post("/api/cards", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      setCardDialogOpen(false);
      toast.success("Card saved successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save card.");
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/cards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      toast.success("Card removed.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove card.");
    },
  });

  const entryMutation = useMutation({
    mutationFn: (v: { id: string; amount: number; kind: "deposit" | "withdraw"; note?: string }) =>
      api.post(`/api/bank/${v.id}/entry`, { amount: v.amount, kind: v.kind, note: v.note?.trim() || null }),
    onSuccess: (_, variables) => {
      invalidateAll();
      setDepositAmount("");
      setDepositNote("");
      setWithdrawAmount("");
      setWithdrawNote("");
      toast.success(
        variables.kind === "deposit"
          ? "Deposit registered successfully!"
          : "Withdrawal registered successfully!"
      );
    },
    onError: (err: any) => {
      toast.error(err.message || "Transaction failed.");
    },
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      api.post("/api/bank/transfer", {
        fromId: selectedAccountId,
        toId: xfer.toId,
        amount: rupeesToPaise(Number(xfer.amount)),
      }),
    onSuccess: () => {
      invalidateAll();
      setXfer({ toId: "", amount: "", note: "" });
      toast.success("Funds transferred successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Transfer failed.");
    },
  });

  // KPI calculations
  const totalAssets = accounts?.reduce((s, a) => s + a.balance, 0) ?? 0;
  const bankBalances =
    accounts
      ?.filter((a) => a.type === "bank" || a.type === "upi")
      .reduce((s, a) => s + a.balance, 0) ?? 0;
  const cashBalances =
    accounts?.filter((a) => a.type === "cash").reduce((s, a) => s + a.balance, 0) ?? 0;

  // Filtered ledger entries
  const filteredEntries =
    entries?.filter((e) => {
      if (!ledgerSearch.trim()) return true;
      const term = ledgerSearch.toLowerCase();
      return (
        e.account.name.toLowerCase().includes(term) ||
        e.note?.toLowerCase().includes(term) ||
        e.kind.toLowerCase().includes(term)
      );
    }) ?? [];

  // Form Submission Handlers
  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addAcctMutation.mutate();
  };

  // Called by CreditCardForm on submit. We take the full CardState for the UX,
  // but derive and persist ONLY the PCI-safe subset — the raw PAN and CVV never
  // leave the browser.
  const handleCardFormSubmit = (state: CardState) => {
    const digits = state.number.replace(/\D/g, "");
    const last4 = digits.slice(-4);
    if (last4.length < 4) return;
    const network = detectNetwork(digits);
    const expiryLabel =
      state.month && state.year ? `${state.month}/${state.year.slice(-2)}` : null;
    addCardMutation.mutate({
      label: state.holder.trim() ? `${state.holder.trim()}` : `${network.toUpperCase()} ••${last4}`,
      network,
      kind: "credit",
      last4,
      expiryLabel,
      holderName: state.holder.trim() || null,
    });
  };

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !depositAmount || Number(depositAmount) <= 0) return;
    entryMutation.mutate({
      id: selectedAccountId,
      amount: rupeesToPaise(Number(depositAmount)),
      kind: "deposit",
      note: depositNote,
    });
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !withdrawAmount || Number(withdrawAmount) <= 0) return;
    entryMutation.mutate({
      id: selectedAccountId,
      amount: rupeesToPaise(Number(withdrawAmount)),
      kind: "withdraw",
      note: withdrawNote,
    });
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !xfer.toId || !xfer.amount || Number(xfer.amount) <= 0) return;
    transferMutation.mutate();
  };

  const inputStyle =
    "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 dark:border-zinc-800 dark:bg-zinc-950";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Back button and Page Title */}
      <div className="flex flex-col gap-4 border-b border-gray-100 pb-6 md:flex-row md:items-center justify-between dark:border-zinc-800">
        <div>
          <Link href="/" className="text-xs font-semibold text-[#16a34a] hover:underline flex items-center gap-1 mb-1">
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Cash &amp; Bank Portal
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Administer accounts, perform inter-bank transfers, and check transaction ledger history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Deferred: real bank sync needs an Account Aggregator / open-banking
              integration (RBI-regulated). Surfaced as a disabled affordance so the
              roadmap is visible without implying it works. */}
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Coming soon — automatic sync via the Account Aggregator framework"
            className="h-9 gap-2 rounded-xl text-gray-400 border-gray-200 dark:border-zinc-800 cursor-not-allowed"
          >
            <RefreshCw className="h-4 w-4" />
            Auto-sync <span className="text-[10px] font-bold uppercase text-gray-300">Soon</span>
          </Button>
          <Button
            onClick={invalidateAll}
            variant="outline"
            size="sm"
            className="h-9 gap-2 rounded-xl text-gray-500 border-gray-200 dark:border-zinc-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => setActiveTab("add")}
            size="sm"
            className="h-9 gap-2 rounded-xl bg-[#16a34a] hover:bg-[#117a37] font-bold text-white"
          >
            <PlusCircle className="h-4 w-4" />
            Add Bank Account
          </Button>
        </div>
      </div>

      {/* 1. Header Assets KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-500 to-emerald-600" />
          <CardContent className="flex items-center justify-between p-6">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                Net Assets Value
              </span>
              <h2 className={cn("text-2xl font-bold tracking-tight", totalAssets < 0 ? "text-red-500" : "text-gray-900 dark:text-white")}>
                {formatINR(totalAssets)}
              </h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400">
              <Sparkles className="h-5.5 w-5.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
          <CardContent className="flex items-center justify-between p-6">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                Bank &amp; UPI Balances
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {formatINR(bankBalances)}
              </h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400">
              <Landmark className="h-5.5 w-5.5" />
            </div>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
          <CardContent className="flex items-center justify-between p-6">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                Cash in Hand
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {formatINR(cashBalances)}
              </h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400">
              <Wallet className="h-5.5 w-5.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Main Workspace Split Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Side: Accounts Directory */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-zinc-400">
              Active Accounts
            </h3>
            <Badge variant="outline" className="h-5 text-[10px] border-gray-200 text-gray-500">
              {accounts?.length ?? 0} Accounts
            </Badge>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {accountsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-2xl" />
              ))
            ) : accounts?.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center dark:border-zinc-800">
                <Landmark className="mx-auto h-8 w-8 text-gray-300" />
                <h4 className="mt-2 text-sm font-bold text-gray-800 dark:text-gray-300">No accounts yet</h4>
                <p className="text-xs text-gray-400 mt-1">Add your first bank, cash, or UPI account to start tracking balances.</p>
                <Button
                  onClick={() => setActiveTab("add")}
                  size="sm"
                  className="mt-4 gap-2 rounded-xl bg-[#16a34a] hover:bg-[#117a37] font-bold text-white"
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Bank Account
                </Button>
              </div>
            ) : (
              accounts?.map((a) => {
                const isSelected = a.id === selectedAccountId;
                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAccountId(a.id)}
                    className={cn(
                      "cursor-pointer relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 hover:shadow-sm",
                      isSelected
                        ? "border-[#16a34a] bg-green-50/20 shadow-sm dark:bg-green-950/10"
                        : "border-gray-100 bg-white hover:border-gray-250 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:border-zinc-800"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            a.type === "cash" && "bg-amber-50 text-amber-600 dark:bg-amber-950/20",
                            a.type === "upi" && "bg-blue-50 text-blue-600 dark:bg-blue-950/20",
                            a.type !== "cash" && a.type !== "upi" && "bg-emerald-50 text-[#16a34a] dark:bg-green-950/20"
                          )}
                        >
                          {a.type === "cash" && <Wallet className="h-5 w-5" />}
                          {a.type === "upi" && <Zap className="h-5 w-5" />}
                          {a.type !== "cash" && a.type !== "upi" && <Landmark className="h-5 w-5" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white leading-tight">
                            {a.name}
                          </h4>
                          <p className="text-xs text-gray-400 capitalize mt-1 font-semibold flex items-center gap-1.5">
                            <span className="uppercase text-[9px] bg-gray-150 text-gray-600 dark:bg-zinc-900 dark:text-zinc-400 px-1.5 py-0.5 rounded-md font-bold">
                              {a.type}
                            </span>
                            {a.accountNo && <span>· Account: {a.accountNo}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <h4 className={cn("font-extrabold text-sm", a.balance < 0 ? "text-red-500" : "text-gray-900 dark:text-white")}>
                          {formatINR(a.balance)}
                        </h4>
                        {a.ifsc && <p className="text-[10px] text-gray-400 mt-1 uppercase font-semibold">IFSC: {a.ifsc}</p>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Account Actions Console */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 px-1">
            <Layers className="h-4.5 w-4.5 text-gray-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-zinc-400">
              Operations Center
            </h3>
          </div>

          <Card className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            {selectedAccount ? (
              <div className="mb-4 rounded-xl border border-gray-50 bg-gray-50/50 p-4 dark:border-zinc-900 dark:bg-zinc-900/30">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  Target Account Context
                </p>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-gray-800 dark:text-white">{selectedAccount.name}</span>
                    <Badge className="bg-[#16a34a]/10 text-[#16a34a] border-transparent font-bold capitalize text-[10px] py-0 px-2 h-5 hover:bg-[#16a34a]/15">
                      {selectedAccount.type}
                    </Badge>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-500">Active Balance:</span>{" "}
                    <span className={cn("font-bold", selectedAccount.balance < 0 ? "text-red-500" : "text-green-600")}>
                      {formatINR(selectedAccount.balance)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-gray-50 p-4 text-xs font-semibold text-gray-500 dark:bg-zinc-900">
                <Info className="h-4.5 w-4.5 text-gray-400 shrink-0" />
                Select an account on the left to activate deposits, withdrawals, or transfers.
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 rounded-xl bg-gray-100 p-1 dark:bg-zinc-900">
                <TabsTrigger value="deposit" disabled={!selectedAccountId} className="rounded-lg text-xs py-1.5 font-bold">
                  Deposit
                </TabsTrigger>
                <TabsTrigger value="withdraw" disabled={!selectedAccountId} className="rounded-lg text-xs py-1.5 font-bold">
                  Withdraw
                </TabsTrigger>
                <TabsTrigger value="transfer" disabled={!selectedAccountId || (accounts && accounts.length < 2)} className="rounded-lg text-xs py-1.5 font-bold">
                  Transfer
                </TabsTrigger>
                <TabsTrigger value="add" className="rounded-lg text-xs py-1.5 font-bold">
                  + Account
                </TabsTrigger>
              </TabsList>

              {/* 2a. Deposit Form */}
              <TabsContent value="deposit" className="outline-none">
                <form onSubmit={handleDepositSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                        Amount to Deposit (₹)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        required
                        className="rounded-xl border-gray-200 focus-visible:ring-1 focus-visible:ring-[#16a34a]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                        Deposit Reference Note
                      </label>
                      <Input
                        placeholder="Cash collection, self deposit, etc."
                        value={depositNote}
                        onChange={(e) => setDepositNote(e.target.value)}
                        className="rounded-xl border-gray-200 focus-visible:ring-1"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={entryMutation.isPending || !depositAmount}
                      className="rounded-xl bg-[#16a34a] hover:bg-[#117a37] font-bold text-white px-5"
                    >
                      {entryMutation.isPending ? "Depositing…" : "Submit Deposit"}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* 2b. Withdraw Form */}
              <TabsContent value="withdraw" className="outline-none">
                <form onSubmit={handleWithdrawSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                        Amount to Withdraw (₹)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        required
                        className="rounded-xl border-gray-200 focus-visible:ring-1 focus-visible:ring-[#16a34a]"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                        Withdrawal Reference Note
                      </label>
                      <Input
                        placeholder="ATM cash withdraw, salary pay out, etc."
                        value={withdrawNote}
                        onChange={(e) => setWithdrawNote(e.target.value)}
                        className="rounded-xl border-gray-200 focus-visible:ring-1"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={entryMutation.isPending || !withdrawAmount}
                      className="rounded-xl bg-rose-600 hover:bg-rose-700 font-bold text-white px-5"
                    >
                      {entryMutation.isPending ? "Withdrawing…" : "Submit Withdrawal"}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* 2c. Transfer Form */}
              <TabsContent value="transfer" className="outline-none">
                <form onSubmit={handleTransferSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                        Transfer Out from
                      </label>
                      <select disabled className={cn(inputStyle, "bg-gray-50 opacity-80 cursor-not-allowed")}>
                        <option value={selectedAccountId ?? ""}>
                          {selectedAccount?.name || "Source account"}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                        Transfer In to
                      </label>
                      <select
                        value={xfer.toId}
                        onChange={(e) => setXfer({ ...xfer, toId: e.target.value })}
                        required
                        className={inputStyle}
                      >
                        <option value="">Choose target account…</option>
                        {accounts
                          ?.filter((a) => a.id !== selectedAccountId)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({formatINR(a.balance)})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                        Transfer Amount (₹)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={xfer.amount}
                        onChange={(e) => setXfer({ ...xfer, amount: e.target.value })}
                        required
                        className="rounded-xl border-gray-200 focus-visible:ring-1 focus-visible:ring-[#16a34a]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={transferMutation.isPending || !xfer.toId || !xfer.amount}
                      className="rounded-xl bg-[#16a34a] hover:bg-[#117a37] font-bold text-white px-5"
                    >
                      {transferMutation.isPending ? "Transferring…" : "Execute Transfer"}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* 2d. Add Account Form */}
              <TabsContent value="add" className="outline-none">
                <form onSubmit={handleAddAccount} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                        Account Name
                      </label>
                      <Input
                        placeholder="e.g. HDFC Bank, Office Petty Cash"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="rounded-xl border-gray-200"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                        Account Type
                      </label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className={inputStyle}
                      >
                        <option value="bank">Bank Account</option>
                        <option value="cash">Cash In Hand</option>
                        <option value="upi">UPI ID</option>
                      </select>
                    </div>

                    <div className="sm:col-span-1">
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                        Opening Balance (₹)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={opening}
                        onChange={(e) => setOpening(e.target.value)}
                        className="rounded-xl border-gray-200"
                      />
                    </div>
                  </div>

                  {type !== "cash" && (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                            Bank Name
                          </label>
                          <Input
                            placeholder="e.g. HDFC Bank"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            className="rounded-xl border-gray-200"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                            Branch
                          </label>
                          <Input
                            placeholder="e.g. MG Road, Bengaluru"
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            className="rounded-xl border-gray-200"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                            Account Number
                          </label>
                          <Input
                            placeholder="e.g. 50100234567891"
                            value={accountNo}
                            onChange={(e) => setAccountNo(e.target.value)}
                            className="rounded-xl border-gray-200"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                            IFSC Code
                          </label>
                          <Input
                            placeholder="e.g. HDFC0000123"
                            value={ifsc}
                            onChange={(e) => setIfsc(e.target.value)}
                            className="rounded-xl border-gray-200"
                          />
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                            Account Holder Name
                          </label>
                          <Input
                            placeholder="e.g. Acme Traders Pvt Ltd"
                            value={holderName}
                            onChange={(e) => setHolderName(e.target.value)}
                            className="rounded-xl border-gray-200"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-zinc-400">
                            UPI ID {type === "upi" && <span className="text-rose-500">*</span>}
                          </label>
                          <Input
                            placeholder="e.g. acmetraders@okhdfcbank"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            className="rounded-xl border-gray-200"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={addAcctMutation.isPending || !name.trim()}
                      className="rounded-xl bg-[#16a34a] hover:bg-[#117a37] font-bold text-white px-5 gap-2"
                    >
                      <PlusCircle className="h-4.5 w-4.5" />
                      Add Account
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* 3. Payment Methods (saved cards) */}
      <Card className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4.5 w-4.5 text-gray-400" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Payment Methods</h3>
          </div>
          <Button
            onClick={() => setCardDialogOpen(true)}
            size="sm"
            className="h-9 gap-2 rounded-xl bg-[#16a34a] hover:bg-[#117a37] font-bold text-white"
          >
            <PlusCircle className="h-4 w-4" />
            Add Card
          </Button>
        </div>
        <div className="mb-6 flex items-start gap-2 rounded-xl bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            For your security we store <strong>only the last 4 digits</strong>, network, and expiry label —
            never the full card number and never the CVV. This is a reference label, not a payment credential.
          </p>
        </div>

        <div>
          {/* Saved cards list */}
          <div className="space-y-3">
            {cardsLoading ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
            ) : !cards || cards.length === 0 ? (
              <div className="flex h-full min-h-[140px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/40 p-8 text-center dark:border-zinc-800">
                <CreditCard className="h-8 w-8 text-gray-300" />
                <h4 className="mt-2 text-sm font-bold text-gray-800 dark:text-gray-300">No saved cards</h4>
                <p className="text-xs text-gray-400 mt-1">Use “Add Card” above to keep a quick reference to your business cards.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {cards.map((c) => (
                  <div
                    key={c.id}
                    className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-900 to-gray-700 p-5 text-white shadow-sm dark:border-zinc-800 dark:from-zinc-800 dark:to-zinc-950"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-bold uppercase tracking-widest text-white/70">{c.network}</span>
                      <button
                        onClick={() => deleteCardMutation.mutate(c.id)}
                        disabled={deleteCardMutation.isPending}
                        title="Remove card"
                        className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-4 font-mono text-lg tracking-widest">•••• {c.last4}</p>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-white/50">{c.holderName || c.label}</p>
                        <p className="text-xs font-semibold capitalize text-white/80">{c.kind}</p>
                      </div>
                      {c.expiryLabel && (
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-white/50">Expires</p>
                          <p className="text-xs font-semibold text-white/80">{c.expiryLabel}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Add-card dialog — hosts the CreditCardForm component. Full PAN + CVV are
          captured only in the component's local state for the entry UX; on submit
          we persist just the PCI-safe subset (see handleCardFormSubmit). */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent className="max-w-[1040px] sm:max-w-[1040px] gap-0 overflow-y-auto max-h-[92vh] p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Add a payment card</DialogTitle>
            <DialogDescription>
              For your security we store only the last 4 digits, card network, and expiry label —
              never the full card number and never the CVV.
            </DialogDescription>
          </DialogHeader>
          <CreditCardForm maskMiddle onSubmit={(state) => handleCardFormSubmit(state)} />
        </DialogContent>
      </Dialog>

      {/* 4. Transaction History Log (Bank & Cash Ledger) */}
      <Card className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Cash &amp; Bank Ledger</h3>
            <p className="text-xs text-gray-500">Chronological history log of all cash flows and inter-account movements</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search ledger entries..."
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              className="pl-9 rounded-xl border-gray-200 focus-visible:ring-1"
            />
          </div>
        </div>

        {ledgerLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-gray-100 rounded-xl dark:border-zinc-850">
            <Info className="mx-auto h-8 w-8 text-gray-300" />
            <h4 className="mt-2 text-sm font-bold text-gray-800 dark:text-gray-300">No bank records</h4>
            <p className="text-xs text-gray-400 mt-1">There are no deposits, withdrawals or transfers registered.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-zinc-850">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-xs font-bold uppercase tracking-wider text-gray-400 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Account</th>
                  <th className="px-5 py-3">Reference / Type</th>
                  <th className="px-5 py-3">Note Description</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-900">
                {filteredEntries.map((e) => {
                  const isIn = e.kind === "deposit" || e.kind === "transfer_in";
                  return (
                    <tr key={e.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-900/30">
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-gray-400">
                        {new Date(e.date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white">
                            {e.account.name}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                            ({e.account.type})
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] py-0 px-2 font-bold uppercase border-transparent shrink-0",
                            e.kind === "deposit" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20",
                            e.kind === "withdraw" && "bg-rose-50 text-rose-700 dark:bg-rose-950/20",
                            e.kind === "transfer_in" && "bg-blue-50 text-blue-700 dark:bg-blue-950/20",
                            e.kind === "transfer_out" && "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20"
                          )}
                        >
                          {e.kind.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-gray-500 max-w-xs truncate" title={e.note ?? ""}>
                        {e.note || "—"}
                      </td>
                      <td className={cn("px-5 py-3 text-right font-extrabold", isIn ? "text-emerald-600" : "text-rose-600")}>
                        {isIn ? "+" : "-"} {formatINR(Math.abs(e.amount))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
