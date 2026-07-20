"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { computeInvoice, formatINR } from "@invoixe/core";
import type { Item, Party } from "@invoixe/types";
import { api } from "../../lib/api";
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  ArrowLeft,
  X,
  Package,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type Cart = Record<string, number>; // itemId -> qty

export default function PosPage() {
  const router = useRouter();

  // Queries
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["items"],
    queryFn: () => api.get<(Item & { currentStock: number })[]>("/api/items"),
  });
  const { data: parties } = useQuery({
    queryKey: ["parties"],
    queryFn: () => api.get<Party[]>("/api/parties"),
  });

  // State
  const [cart, setCart] = useState<Cart>({});
  const [partyId, setPartyId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "bank_transfer">("cash");
  const [receiptInvoice, setReceiptInvoice] = useState<{ id: string; number: string } | null>(null);

  // Category list dynamically built from real database categories
  const categories = useMemo(() => {
    if (!items) return ["all"];
    const cats = new Set<string>();
    items.forEach((i) => {
      const catName = i.categoryName || i.category?.name;
      if (catName) cats.add(catName);
    });
    return ["all", ...Array.from(cats)];
  }, [items]);

  // Filtered items matching search query & category
  const filteredItems = useMemo(() => {
    return (items ?? []).filter((i) => {
      const catName = i.categoryName || i.category?.name || "";

      const matchesSearch =
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.itemCode && i.itemCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (i.barcode && i.barcode.includes(searchQuery));

      const matchesCategory =
        selectedCategory === "all" || catName === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, selectedCategory]);

  // Cart items calculation
  const cartItems = useMemo(() => {
    return Object.entries(cart).flatMap(([id, qty]) => {
      const item = items?.find((i) => i.id === id);
      return item ? [{ item, qty }] : [];
    });
  }, [cart, items]);

  // Invoice calculations
  const invoiceData = useMemo(() => {
    const rawLines = cartItems.map((c) => ({
      qty: c.qty,
      rate: c.item.salePrice,
      taxRate: c.item.taxRate,
    }));
    if (!rawLines.length) return { grandTotal: 0, subTotal: 0, totalTax: 0 };

    const calculated = computeInvoice({
      sellerStateCode: "27",
      buyerStateCode: "27",
      lines: rawLines,
    });

    return {
      grandTotal: calculated.totals.grandTotal,
      subTotal: calculated.totals.subTotal,
      totalTax: calculated.totals.totalTax,
    };
  }, [cartItems]);

  // Cart operations
  const updateCart = (id: string, delta: number) => {
    setCart((prev) => {
      const current = prev[id] ?? 0;
      const nextQty = current + delta;
      const nextCart = { ...prev };
      if (nextQty <= 0) {
        delete nextCart[id];
      } else {
        nextCart[id] = nextQty;
      }
      return nextCart;
    });
  };

  const clearCart = () => setCart({});

  // Charge mutation
  const chargeMutation = useMutation({
    mutationFn: () =>
      api.post<{ id: string; number?: string }>("/api/invoices", {
        partyId: partyId || null,
        paymentMode,
        lines: cartItems.map((c) => ({
          itemId: c.item.id,
          description: c.item.name,
          hsnSac: c.item.hsnSac ?? null,
          qty: c.qty,
          rate: c.item.salePrice,
          taxRate: c.item.taxRate,
        })),
      }),
    onSuccess: (inv) => {
      toast.success("Sale completed successfully!");
      setReceiptInvoice({ id: inv.id, number: inv.number || `INV-${inv.id.slice(0, 6).toUpperCase()}` });
    },
    onError: () => toast.error("Could not process sale"),
  });

  const selectedParty = parties?.find((p) => p.id === partyId);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-zinc-50/50">
      {/* ── Container ── */}
      <div className="w-full px-6 sm:px-8 py-6 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200/80 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900">POS Billing</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Quick checkout terminal & instant receipts</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items by name..."
              className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-9 py-2.5 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Main Layout: Clean Products + Cart Sidebar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-6 items-start">
          {/* Left Column: Simple Product Catalog */}
          <div className="space-y-5">
            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200/60 pb-3">
              {categories.map((cat) => {
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                      active
                        ? "bg-emerald-800 text-white border-emerald-800 shadow-2xs"
                        : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300"
                    }`}
                  >
                    {cat === "all" ? "All Products" : cat}
                  </button>
                );
              })}
            </div>

            {/* Simple Product Grid */}
            {itemsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-36 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white py-16 text-center">
                <Package className="h-8 w-8 text-zinc-300" />
                <p className="mt-2 text-sm font-semibold text-zinc-700">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                {filteredItems.map((it) => {
                  const qtyInCart = cart[it.id] ?? 0;

                  return (
                    <div
                      key={it.id}
                      onClick={() => updateCart(it.id, 1)}
                      className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-150 flex flex-col justify-between h-36 ${
                        qtyInCart > 0
                          ? "border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-500/20 shadow-2xs"
                          : "border-zinc-200/90 bg-white hover:border-emerald-500 hover:shadow-sm"
                      }`}
                    >
                      {/* Top: Name & Stock */}
                      <div>
                        <h4 className="font-bold text-sm text-zinc-900 line-clamp-2 group-hover:text-emerald-800">
                          {it.name}
                        </h4>
                        <p className="text-[11px] text-zinc-500 font-medium mt-1">
                          {typeof it.currentStock === "number"
                            ? `${it.currentStock.toLocaleString("en-IN")} ${it.unit || "PCS"} in stock`
                            : "Out of stock"}
                        </p>
                      </div>

                      {/* Bottom: Price + Action */}
                      <div className="flex items-center justify-between border-t border-zinc-100 pt-2.5">
                        <span className="text-base font-extrabold text-zinc-900">
                          {formatINR(it.salePrice)}
                        </span>

                        {qtyInCart > 0 ? (
                          <span className="text-[11px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                            {qtyInCart} in cart
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700 opacity-0 group-hover:opacity-100 transition">
                            + Add
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Sleek Cart Sidebar */}
          <aside className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-6">
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-zinc-800" />
                <h2 className="text-sm font-bold text-zinc-900">Current Cart</h2>
              </div>
              {cartItems.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs font-semibold text-zinc-400 hover:text-red-600 transition"
                >
                  Clear Cart
                </button>
              )}
            </div>

            {/* Customer Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700">Billing Customer</label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-emerald-600 focus:bg-white"
              >
                <option value="">Walk-in / Cash Customer</option>
                {parties?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.phone ? `(${p.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items List */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Order Items ({cartItems.reduce((acc, c) => acc + c.qty, 0)})
              </div>

              <div className="max-h-72 min-h-[140px] overflow-y-auto space-y-2.5 pr-1.5">
                {cartItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-400 space-y-1">
                    <p className="text-xs font-medium">Cart is empty</p>
                    <p className="text-[11px]">Click or tap products from the grid to add</p>
                  </div>
                ) : (
                  cartItems.map((c) => (
                    <div
                      key={c.item.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3.5 py-2.5 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-zinc-900 truncate" title={c.item.name}>
                          {c.item.name}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-0.5 shadow-2xs">
                          <button
                            onClick={() => updateCart(c.item.id, -1)}
                            className="flex h-5 w-5 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-extrabold text-zinc-900">
                            {c.qty}
                          </span>
                          <button
                            onClick={() => updateCart(c.item.id, 1)}
                            className="flex h-5 w-5 items-center justify-center rounded bg-zinc-900 text-white hover:bg-zinc-800"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="w-16 text-right font-extrabold text-zinc-900">
                          {formatINR(c.item.salePrice * c.qty)}
                        </div>

                        <button
                          onClick={() => updateCart(c.item.id, -c.qty)}
                          className="text-zinc-400 hover:text-red-600 transition"
                          title="Remove item"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Payment Method */}
            {cartItems.length > 0 && (
              <div className="space-y-1.5 border-t border-zinc-100 pt-4">
                <label className="text-xs font-semibold text-zinc-700">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "cash", label: "Cash" },
                    { id: "upi", label: "UPI" },
                    { id: "card", label: "Card" },
                    { id: "bank_transfer", label: "Bank" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setPaymentMode(mode.id as any)}
                      className={`rounded-lg py-2 text-xs font-bold transition border ${
                        paymentMode === mode.id
                          ? "border-emerald-700 bg-emerald-50 text-emerald-900 shadow-2xs"
                          : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Summary & Tally */}
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-600 font-medium">
                <span>Subtotal</span>
                <span>{formatINR(invoiceData.subTotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 font-medium">
                <span>Estimated GST</span>
                <span>{formatINR(invoiceData.totalTax)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200/80 pt-2 text-sm font-extrabold text-zinc-900">
                <span>Total Amount</span>
                <span className="text-emerald-700">{formatINR(invoiceData.grandTotal)}</span>
              </div>
            </div>

            {/* Primary Action */}
            <button
              onClick={() => chargeMutation.mutate()}
              disabled={chargeMutation.isPending || cartItems.length === 0}
              className="w-full rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-2xs transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {chargeMutation.isPending ? "Processing..." : `Charge ${formatINR(invoiceData.grandTotal)}`}
            </button>
          </aside>
        </div>
      </div>

      {/* Thermal Receipt Dialog */}
      <Dialog open={!!receiptInvoice} onOpenChange={() => setReceiptInvoice(null)}>
        <DialogContent className="max-w-sm p-6 text-zinc-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Sale Completed
            </DialogTitle>
          </DialogHeader>

          {receiptInvoice && (
            <div className="space-y-4 mt-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs space-y-2">
                <div className="text-center font-bold text-sm border-b border-dashed border-zinc-300 pb-2">
                  RECEIPT #{receiptInvoice.number}
                </div>
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{selectedParty?.name || "Walk-in Customer"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mode:</span>
                  <span className="uppercase font-bold">{paymentMode}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-zinc-300 pt-2 font-bold text-sm">
                  <span>TOTAL PAID:</span>
                  <span>{formatINR(invoiceData.grandTotal)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    clearCart();
                    router.push(`/invoices/${receiptInvoice.id}/thermal`);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <Printer className="h-4 w-4" /> Print Thermal
                </button>
                <button
                  onClick={() => {
                    clearCart();
                    setReceiptInvoice(null);
                  }}
                  className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-100"
                >
                  New Sale
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
