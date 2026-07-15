"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, MoreHorizontal, Phone, Trash2, Info, Eye, EyeOff, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { formatINR } from "@invoixe/core";
import { gstinSchema, phoneSchema, stateNameFromGstin } from "@invoixe/types";
import type { Party, PartyType, GstinDetails } from "@invoixe/types";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/page-header";
import { DataTable, type Column } from "../../components/data-table";
import { MoneyInput } from "../../components/money-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PARTY_TYPES: PartyType[] = ["customer", "supplier", "both"];

const GST_TYPES = [
  "Unregistered/Consumer",
  "Registered Business - Regular",
  "Registered Business - Composition",
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

// Plain enums (no `.default()`) so RHF input/output types match exactly.
const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(["customer", "supplier", "both"]),
  status: z.enum(["active", "inactive"]),
  groupName: z.string(),
  phone: z.union([z.literal(""), phoneSchema]),
  gstin: z.union([z.literal(""), gstinSchema]),
  openingBalance: z.number().int().nullable(),
  // GST & Address tab
  gstType: z.string(),
  state: z.string(),
  email: z.string().email().or(z.literal("")),
  billingAddress: z.string(),
  shippingAddress: z.string(),
  // Credit & Balance tab
  asOfDate: z.string(),
  creditLimit: z.number().int().nullable(),
  creditPeriodDays: z.number().int().nullable(),
  // Additional Fields tab
  field1Enabled: z.boolean(),
  field1Value: z.string(),
  field2Enabled: z.boolean(),
  field2Value: z.string(),
  field3Enabled: z.boolean(),
  field3Value: z.string(),
  field4Enabled: z.boolean(),
  field4Value: z.string(),
  field4Date: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

// Default date formatted for input type="date" (YYYY-MM-DD)
const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const DEFAULTS: FormValues = {
  name: "",
  type: "customer",
  status: "active",
  groupName: "",
  phone: "",
  gstin: "",
  openingBalance: null,
  gstType: "Unregistered/Consumer",
  state: "",
  email: "",
  billingAddress: "",
  shippingAddress: "",
  asOfDate: getTodayDateString(),
  creditLimit: null,
  creditPeriodDays: null,
  field1Enabled: false,
  field1Value: "",
  field2Enabled: false,
  field2Value: "",
  field3Enabled: false,
  field3Value: "",
  field4Enabled: false,
  field4Value: "",
  field4Date: "",
};

interface PartyDialogProps {
  party?: Party | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}

// Session-scoped cache of resolved GSTIN lookups. Each successful lookup spends
// one provider credit, so re-typing a GSTIN we've already resolved is served
// from here — no second network call, no extra credit. Cleared on page reload.
const gstinCache = new Map<string, GstinDetails>();

function PartyDialog({ party, open, onOpenChange, trigger }: PartyDialogProps) {
  const qc = useQueryClient();
  const [showShipping, setShowShipping] = useState(false);
  const [customLimit, setCustomLimit] = useState(false);
  const [activeTab, setActiveTab] = useState("gst");

  // Detailed address visibility state
  const [detailedBilling, setDetailedBilling] = useState(false);
  const [detailedShipping, setDetailedShipping] = useState(false);

  // Detailed billing fields state
  const [billLine1, setBillLine1] = useState("");
  const [billLine2, setBillLine2] = useState("");
  const [billCity, setBillCity] = useState("");
  const [billState, setBillState] = useState("");
  const [billPincode, setBillPincode] = useState("");
  const [billCountry, setBillCountry] = useState("India");

  // Detailed shipping fields state
  const [shipLine1, setShipLine1] = useState("");
  const [shipLine2, setShipLine2] = useState("");
  const [shipCity, setShipCity] = useState("");
  const [shipState, setShipState] = useState("");
  const [shipPincode, setShipPincode] = useState("");
  const [shipCountry, setShipCountry] = useState("India");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULTS,
  });

  const isEdit = !!party;

  // GSTIN auto-fill: fetch the registered taxpayer's details and populate the
  // form. `lastLookup` guards against re-fetching the same GSTIN (and against
  // auto-fetching an existing party's own GSTIN when opening the edit dialog).
  // `inFlight` is a synchronous guard so two near-simultaneous triggers (e.g. a
  // debounced auto-fetch racing a manual click, or a StrictMode re-run) can
  // never spend two credits on the same GSTIN.
  const [gstLoading, setGstLoading] = useState(false);
  const lastLookup = useRef<string>("");
  const inFlight = useRef<string | null>(null);

  // Fill the form from resolved details. Only overwrites name/address when empty
  // so it never clobbers something the user typed.
  const applyGstinDetails = (d: GstinDetails) => {
    const fetchedName = d.tradeName?.trim() || d.legalName?.trim();
    if (fetchedName && !form.getValues("name").trim()) {
      form.setValue("name", fetchedName, { shouldValidate: true });
    }

    const dty = (d.taxpayerType ?? "").toLowerCase();
    form.setValue(
      "gstType",
      dty.includes("comp")
        ? "Registered Business - Composition"
        : "Registered Business - Regular",
    );

    if (d.state) {
      const match = INDIAN_STATES.find((s) => s.toLowerCase() === d.state!.toLowerCase());
      if (match) form.setValue("state", match);
    }

    if (d.address?.trim() && !form.getValues("billingAddress").trim()) {
      form.setValue("billingAddress", d.address.trim());
    }
  };

  // `force` bypasses the cache (used by the manual re-fetch button); the
  // debounced auto-fetch always prefers the cache to conserve credits.
  const lookupGstin = async (raw: string, force = false) => {
    const gstin = raw.toUpperCase();
    if (!gstinSchema.safeParse(gstin).success) return;

    // State is encoded in the GSTIN prefix — fill it with no network call.
    const derivedState = stateNameFromGstin(gstin);
    if (derivedState) form.setValue("state", derivedState);

    // Already resolved this GSTIN this session → reuse it, spend no credit.
    const cached = gstinCache.get(gstin);
    if (cached && !force) {
      lastLookup.current = gstin;
      applyGstinDetails(cached);
      return;
    }

    // A request for this exact GSTIN is already running — don't fire a second.
    if (inFlight.current === gstin) return;
    inFlight.current = gstin;
    lastLookup.current = gstin;

    setGstLoading(true);
    try {
      const d = await api.get<GstinDetails>(`/api/gst/lookup/${gstin}`);
      gstinCache.set(gstin, d);
      applyGstinDetails(d);
      toast.success(`Fetched ${d.tradeName?.trim() || d.legalName?.trim() || gstin}`);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "gst_lookup_unconfigured") {
        // No provider key configured — state was still auto-filled offline.
        if (derivedState) toast.info("GST lookup isn't configured; filled state from GSTIN");
        else toast.error("GST lookup is not configured on the server");
      } else if (code === "gstin_not_found") {
        toast.error("No taxpayer found for this GSTIN");
      } else {
        toast.error("Could not fetch GSTIN details");
      }
    } finally {
      setGstLoading(false);
      inFlight.current = null;
    }
  };

  // Auto-fetch once a complete, valid GSTIN has been entered (debounced).
  const gstinValue = form.watch("gstin");
  useEffect(() => {
    const g = (gstinValue ?? "").toUpperCase();
    if (g.length !== 15 || !gstinSchema.safeParse(g).success) return;
    if (lastLookup.current === g) return;
    const t = setTimeout(() => void lookupGstin(g), 600);
    return () => clearTimeout(t);
    // lookupGstin is stable within this render for the given form instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gstinValue]);

  useEffect(() => {
    if (open) {
      // Seed the lookup guard with the current GSTIN so opening the dialog never
      // auto-overwrites an existing party's details; typing a new one re-triggers.
      lastLookup.current = (party?.gstin ?? "").toUpperCase();
      setGstLoading(false);
      if (party) {
        form.reset({
          name: party.name,
          type: party.type,
          status: party.status as "active" | "inactive",
          groupName: party.groupName || "",
          phone: party.phone || "",
          gstin: party.gstin || "",
          openingBalance: party.openingBalance,
          gstType: party.gstin ? "Registered Business - Regular" : "Unregistered/Consumer",
          state: party.stateCode || "",
          email: party.email || "",
          billingAddress: party.billingAddress || "",
          shippingAddress: party.shippingAddress || "",
          asOfDate: getTodayDateString(),
          creditLimit: party.creditLimit,
          creditPeriodDays: party.creditPeriodDays,
          field1Enabled: false,
          field1Value: "",
          field2Enabled: false,
          field2Value: "",
          field3Enabled: false,
          field3Value: "",
          field4Enabled: false,
          field4Value: "",
          field4Date: "",
        });
        setCustomLimit(!!party.creditLimit);
        setShowShipping(!!party.shippingAddress);
      } else {
        form.reset(DEFAULTS);
        setCustomLimit(false);
        setShowShipping(false);
      }
      setActiveTab("gst");
      setDetailedBilling(false);
      setDetailedShipping(false);
    }
  }, [party, open, form]);

  const handleClose = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      form.reset(DEFAULTS);
      setShowShipping(false);
      setCustomLimit(false);
      setActiveTab("gst");
      setDetailedBilling(false);
      setDetailedShipping(false);
      // Reset details
      setBillLine1(""); setBillLine2(""); setBillCity(""); setBillState(""); setBillPincode(""); setBillCountry("India");
      setShipLine1(""); setShipLine2(""); setShipCity(""); setShipState(""); setShipPincode(""); setShipCountry("India");
    }
  };

  const mutation = useMutation({
    mutationFn: (v: FormValues) => {
      const payload = {
        name: v.name.trim(),
        type: v.type,
        status: v.status,
        groupName: v.groupName.trim() || null,
        phone: v.phone || null,
        gstin: v.gstin ? v.gstin.toUpperCase() : null,
        // Derive the 2-digit state code from the GSTIN so place-of-supply /
        // interstate logic in GST returns has it without a separate lookup.
        stateCode: v.gstin ? v.gstin.slice(0, 2) : null,
        openingBalance: v.openingBalance ?? 0,
        billingAddress: v.billingAddress || null,
        shippingAddress: v.shippingAddress || null,
        creditLimit: v.creditLimit ?? null,
        creditPeriodDays: v.creditPeriodDays ?? null,
      };

      if (isEdit && party) {
        return api.patch<Party>(`/api/parties/${party.id}`, payload);
      } else {
        return api.post<Party>("/api/parties", payload);
      }
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["parties"] });
      toast.success(isEdit ? `Updated ${p.name}` : `Added ${p.name}`);
      handleClose(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Request failed"),
  });

  const submitForm = (v: FormValues, andNew: boolean) => {
    mutation.mutate(v, {
      onSuccess: (p) => {
        if (andNew && !isEdit) {
          form.reset(DEFAULTS);
          setShowShipping(false);
          setCustomLimit(false);
          setActiveTab("gst");
          setDetailedBilling(false);
          setDetailedShipping(false);
          setBillLine1(""); setBillLine2(""); setBillCity(""); setBillState(""); setBillPincode(""); setBillCountry("India");
          setShipLine1(""); setShipLine2(""); setShipCity(""); setShipState(""); setShipPincode(""); setShipCountry("India");
        } else {
          handleClose(false);
        }
      },
    });
  };

  // Helper to compile billing address parts
  const updateBilling = (l1: string, l2: string, city: string, st: string, pin: string, country: string) => {
    const parts = [
      l1.trim(),
      l2.trim(),
      city.trim(),
      st && pin ? `${st.trim()} - ${pin.trim()}` : (st ? st.trim() : pin.trim()),
      country.trim()
    ].filter(Boolean);
    form.setValue("billingAddress", parts.join(", "));
  };

  // Helper to compile shipping address parts
  const updateShipping = (l1: string, l2: string, city: string, st: string, pin: string, country: string) => {
    const parts = [
      l1.trim(),
      l2.trim(),
      city.trim(),
      st && pin ? `${st.trim()} - ${pin.trim()}` : (st ? st.trim() : pin.trim()),
      country.trim()
    ].filter(Boolean);
    form.setValue("shippingAddress", parts.join(", "));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="max-w-[860px] p-0 gap-0 overflow-hidden rounded-xl">
        {/* Dialog header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-gray-100">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            {isEdit ? "Edit Party" : "Add Party"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => submitForm(v, false))}>

            {/* ── Top row: Party Name · GSTIN · Phone ── */}
            <div className="px-6 py-4 grid grid-cols-3 gap-3 bg-white border-b border-gray-100">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <Input placeholder="Party Name *" {...field} className="h-10 placeholder:text-gray-400 text-sm" />
                    </FormControl>
                    <FormMessage className="text-xs mt-1" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => {
                  const gstinOk = gstinSchema.safeParse((field.value ?? "").toUpperCase()).success;
                  return (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="GSTIN — auto-fills details"
                          className="h-10 uppercase pr-9 placeholder:text-gray-400 text-sm"
                          {...field}
                          maxLength={15}
                          onChange={(e) => field.onChange(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 15))}
                        />
                        {gstLoading ? (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500 animate-spin" />
                        ) : gstinOk ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => lookupGstin(field.value, true)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-blue-500 hover:bg-blue-50 hover:text-blue-700"
                                  aria-label="Fetch GSTIN details"
                                >
                                  <Search className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs">Fetch registered details for this GSTIN</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p className="text-xs">15-character GST Identification Number</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs mt-1" />
                  </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        placeholder="Phone Number"
                        {...field}
                        maxLength={10}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        className="h-10 placeholder:text-gray-400 text-sm"
                      />
                    </FormControl>
                    <FormMessage className="text-xs mt-1" />
                  </FormItem>
                )}
              />
            </div>

            {/* ── Tabbed body ── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="px-6 bg-white border-b border-gray-100">
                <TabsList className="h-auto bg-transparent p-0 gap-0 rounded-none">
                  {[
                    { value: "gst", label: "GST & Address" },
                    { value: "credit", label: "Credit & Balance" },
                    { value: "additional", label: "Additional Fields" },
                  ].map(({ value, label }) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="
                        rounded-none border-b-2 border-transparent
                        data-[state=active]:border-blue-600 data-[state=active]:text-blue-600
                        data-[state=active]:bg-transparent data-[state=active]:shadow-none
                        px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-700
                        transition-colors flex items-center gap-2
                      "
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* ── GST & Address ── */}
              <TabsContent value="gst" className="m-0 bg-white">
                <div className="px-6 pt-5 pb-5 grid grid-cols-[188px_1fr_1fr] gap-6 min-h-[240px]">

                  {/* Left: GST Type, State, Email */}
                  <div className="flex flex-col gap-3">
                    <FormField
                      control={form.control}
                      name="gstType"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs font-medium text-gray-500 uppercase tracking-wide">GST Type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {GST_TYPES.map((t) => (
                                <SelectItem key={t} value={t} className="text-sm">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="State" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {INDIAN_STATES.map((s) => (
                                <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Email ID"
                              {...field}
                              className="h-9 text-sm placeholder:text-gray-400"
                            />
                          </FormControl>
                          <FormMessage className="text-xs mt-1" />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Middle: Billing Address */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-gray-700">Billing Address</p>
                      <button
                        type="button"
                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                        onClick={() => setDetailedBilling(!detailedBilling)}
                      >
                        {detailedBilling ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" /> Hide Detailed Address
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" /> Show Detailed Address
                          </>
                        )}
                      </button>
                    </div>

                    {!detailedBilling ? (
                      <FormField
                        control={form.control}
                        name="billingAddress"
                        render={({ field }) => (
                          <FormItem className="space-y-0 flex-1">
                            <FormControl>
                              <Textarea
                                placeholder="Billing Address"
                                className="resize-none text-sm placeholder:text-gray-400 h-[118px]"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Input
                          placeholder="Address Line 1"
                          value={billLine1}
                          onChange={(e) => {
                            setBillLine1(e.target.value);
                            updateBilling(e.target.value, billLine2, billCity, billState, billPincode, billCountry);
                          }}
                          className="h-9 text-sm placeholder:text-gray-400"
                        />
                        <Input
                          placeholder="Address Line 2"
                          value={billLine2}
                          onChange={(e) => {
                            setBillLine2(e.target.value);
                            updateBilling(billLine1, e.target.value, billCity, billState, billPincode, billCountry);
                          }}
                          className="h-9 text-sm placeholder:text-gray-400"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="City"
                            value={billCity}
                            onChange={(e) => {
                              setBillCity(e.target.value);
                              updateBilling(billLine1, billLine2, e.target.value, billState, billPincode, billCountry);
                            }}
                            className="h-9 text-sm placeholder:text-gray-400"
                          />
                          <Select
                            value={billState}
                            onValueChange={(val) => {
                              setBillState(val);
                              updateBilling(billLine1, billLine2, billCity, val, billPincode, billCountry);
                            }}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select State" />
                            </SelectTrigger>
                            <SelectContent>
                              {INDIAN_STATES.map((s) => (
                                <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          placeholder="Pincode"
                          value={billPincode}
                          onChange={(e) => {
                            setBillPincode(e.target.value);
                            updateBilling(billLine1, billLine2, billCity, billState, e.target.value, billCountry);
                          }}
                          className="h-9 text-sm placeholder:text-gray-400"
                        />
                        <Select
                          value={billCountry}
                          onValueChange={(val) => {
                            setBillCountry(val);
                            updateBilling(billLine1, billLine2, billCity, billState, billPincode, val);
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="India" className="text-sm">India</SelectItem>
                            <SelectItem value="Other" className="text-sm">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Right: Shipping Address */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-gray-700">Shipping Address</p>
                      {showShipping && (
                        <button
                          type="button"
                          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
                          onClick={() => setDetailedShipping(!detailedShipping)}
                        >
                          {detailedShipping ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" /> Hide Detailed Address
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" /> Show Detailed Address
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {!showShipping ? (
                      <button
                        type="button"
                        onClick={() => setShowShipping(true)}
                        className="text-sm text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1 w-fit"
                      >
                        <span className="text-base font-light">+</span> Enable Shipping Address
                      </button>
                    ) : !detailedShipping ? (
                      <FormField
                        control={form.control}
                        name="shippingAddress"
                        render={({ field }) => (
                          <FormItem className="space-y-0">
                            <FormControl>
                              <Textarea
                                placeholder="Shipping Address"
                                className="resize-none text-sm placeholder:text-gray-400 h-[118px]"
                                {...field}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ) : (
                      <div className="flex flex-col gap-2">
                        <Input
                          placeholder="Address Line 1"
                          value={shipLine1}
                          onChange={(e) => {
                            setShipLine1(e.target.value);
                            updateShipping(e.target.value, shipLine2, shipCity, shipState, shipPincode, shipCountry);
                          }}
                          className="h-9 text-sm placeholder:text-gray-400"
                        />
                        <Input
                          placeholder="Address Line 2"
                          value={shipLine2}
                          onChange={(e) => {
                            setShipLine2(e.target.value);
                            updateShipping(shipLine1, e.target.value, shipCity, shipState, shipPincode, shipCountry);
                          }}
                          className="h-9 text-sm placeholder:text-gray-400"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="City"
                            value={shipCity}
                            onChange={(e) => {
                              setShipCity(e.target.value);
                              updateShipping(shipLine1, shipLine2, e.target.value, shipState, shipPincode, shipCountry);
                            }}
                            className="h-9 text-sm placeholder:text-gray-400"
                          />
                          <Select
                            value={shipState}
                            onValueChange={(val) => {
                              setShipState(val);
                              updateShipping(shipLine1, shipLine2, shipCity, val, shipPincode, shipCountry);
                            }}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select State" />
                            </SelectTrigger>
                            <SelectContent>
                              {INDIAN_STATES.map((s) => (
                                <SelectItem key={s} value={s} className="text-sm">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          placeholder="Pincode"
                          value={shipPincode}
                          onChange={(e) => {
                            setShipPincode(e.target.value);
                            updateShipping(shipLine1, shipLine2, shipCity, shipState, e.target.value, shipCountry);
                          }}
                          className="h-9 text-sm placeholder:text-gray-400"
                        />
                        <Select
                          value={shipCountry}
                          onValueChange={(val) => {
                            setShipCountry(val);
                            updateShipping(shipLine1, shipLine2, shipCity, shipState, shipPincode, val);
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="India" className="text-sm">India</SelectItem>
                            <SelectItem value="Other" className="text-sm">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* ── Credit & Balance (With status/category helper fields) ── */}
              <TabsContent value="credit" className="m-0 bg-white">
                <div className="px-6 pt-5 pb-5 flex flex-col gap-4 min-h-[240px]">
                  
                  {/* Row 1: Opening Balance + As Of Date */}
                  <div className="grid grid-cols-2 gap-x-6">
                    <FormField
                      control={form.control}
                      name="openingBalance"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs text-gray-500 font-medium uppercase tracking-wide">Opening Balance</FormLabel>
                          <FormControl>
                            <MoneyInput value={field.value} onChange={field.onChange} placeholder="Opening Balance" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="asOfDate"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs text-gray-500 font-medium uppercase tracking-wide">As Of Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-10 text-sm" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Row 2: Credit Limit switcher section */}
                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-700">Credit Limit</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">Set a credit cap for this party transaction limits</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className="flex items-center gap-3 mt-1">
                      <span className={cn("text-sm font-medium transition-colors", !customLimit ? "text-gray-900 font-semibold" : "text-gray-400")}>
                        No Limit
                      </span>
                      <Switch
                        checked={customLimit}
                        onCheckedChange={(checked) => {
                          setCustomLimit(checked);
                          if (!checked) {
                            form.setValue("creditLimit", null);
                          }
                        }}
                        className="data-[state=checked]:bg-blue-600"
                      />
                      <span className={cn("text-sm font-semibold transition-colors", customLimit ? "text-blue-600" : "text-gray-400")}>
                        Custom Limit
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Conditional Credit Limit Input */}
                  {customLimit && (
                    <div className="max-w-xs animate-in fade-in slide-in-from-top-1 duration-200">
                      <FormField
                        control={form.control}
                        name="creditLimit"
                        render={({ field }) => (
                          <FormItem className="space-y-1">
                            <FormControl>
                              <MoneyInput value={field.value} onChange={field.onChange} placeholder="Credit Limit" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Row 4: Party Type, Status, Credit Period, Group/Category */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-gray-100 pt-4 mt-2">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs text-gray-500 font-medium uppercase tracking-wide">Party Type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm capitalize">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PARTY_TYPES.map((t) => (
                                <SelectItem key={t} value={t} className="capitalize text-sm">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs text-gray-500 font-medium uppercase tracking-wide">Status</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active" className="text-sm">Active</SelectItem>
                              <SelectItem value="inactive" className="text-sm">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="creditPeriodDays"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs text-gray-500 font-medium uppercase tracking-wide">Credit Period (Days)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              placeholder="e.g. 30"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(e.target.value === "" ? null : Number(e.target.value))
                              }
                              className="h-9 text-sm"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="groupName"
                      render={({ field }) => (
                        <FormItem className="space-y-1">
                          <FormLabel className="text-xs text-gray-500 font-medium uppercase tracking-wide">Group / Category</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Wholesale" {...field} className="h-9 text-sm" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                </div>
              </TabsContent>

              {/* ── Additional Fields (Holds 4 custom fields with checkboxes matching screenshot) ── */}
              <TabsContent value="additional" className="m-0 bg-white">
                <div className="px-6 pt-6 pb-6 flex flex-col gap-4 min-h-[240px]">
                  
                  {/* Field 1 */}
                  <div className="flex items-center gap-3">
                    <FormField
                      control={form.control}
                      name="field1Enabled"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 border-gray-300" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="field1Value"
                      render={({ field }) => (
                        <FormItem className="space-y-0 w-[300px]">
                          <FormControl>
                            <Input
                              placeholder="Additional Field 1 Name"
                              disabled={!form.watch("field1Enabled")}
                              {...field}
                              className="h-10 text-sm placeholder:text-gray-400"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Field 2 */}
                  <div className="flex items-center gap-3">
                    <FormField
                      control={form.control}
                      name="field2Enabled"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 border-gray-300" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="field2Value"
                      render={({ field }) => (
                        <FormItem className="space-y-0 w-[300px]">
                          <FormControl>
                            <Input
                              placeholder="Additional Field 2 Name"
                              disabled={!form.watch("field2Enabled")}
                              {...field}
                              className="h-10 text-sm placeholder:text-gray-400"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Field 3 */}
                  <div className="flex items-center gap-3">
                    <FormField
                      control={form.control}
                      name="field3Enabled"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 border-gray-300" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="field3Value"
                      render={({ field }) => (
                        <FormItem className="space-y-0 w-[300px]">
                          <FormControl>
                            <Input
                              placeholder="Additional Field 3 Name"
                              disabled={!form.watch("field3Enabled")}
                              {...field}
                              className="h-10 text-sm placeholder:text-gray-400"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Field 4 with side-by-side date picker */}
                  <div className="flex items-center gap-3">
                    <FormField
                      control={form.control}
                      name="field4Enabled"
                      render={({ field }) => (
                        <FormItem className="space-y-0">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 border-gray-300" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2 w-[450px]">
                      <FormField
                        control={form.control}
                        name="field4Value"
                        render={({ field }) => (
                          <FormItem className="space-y-0 flex-1">
                            <FormControl>
                              <Input
                                placeholder="Additional Field 4 Name"
                                disabled={!form.watch("field4Enabled")}
                                {...field}
                                className="h-10 text-sm placeholder:text-gray-400"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="field4Date"
                        render={({ field }) => (
                          <FormItem className="space-y-0 w-[160px]">
                            <FormControl>
                              <Input
                                type="date"
                                disabled={!form.watch("field4Enabled")}
                                {...field}
                                className="h-10 text-sm text-gray-500"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                </div>
              </TabsContent>
            </Tabs>

            {/* ── Bottom footer: Save & New | Save ── */}
            <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex-row items-center justify-end gap-3">
              {!isEdit && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full px-6 border-blue-500 text-blue-600 hover:bg-blue-50 font-medium"
                  disabled={mutation.isPending}
                  onClick={() => form.handleSubmit((v) => submitForm(v, true))()}
                >
                  Save &amp; New
                </Button>
              )}
              <Button
                type="submit"
                className="rounded-full px-8 bg-blue-600 hover:bg-blue-700 font-medium"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>

          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function PartiesPage() {
  const qc = useQueryClient();
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: parties, isLoading, error } = useQuery({
    queryKey: ["parties"],
    queryFn: () => api.get<Party[]>("/api/parties"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/parties/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parties"] });
      toast.success("Party deleted");
    },
    onError: () => toast.error("Could not delete party"),
  });

  const columns: Column<Party>[] = [
    {
      key: "name",
      header: "Name",
      cell: (p) => (
        <div className="min-w-0">
          <Link
            href={`/parties/${p.id}`}
            className="font-medium text-gray-900 hover:text-green-700 hover:underline"
          >
            {p.name}
          </Link>
          {(p.phone || p.gstin) && (
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
              {p.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {p.phone}
                </span>
              )}
              {p.phone && p.gstin && <span>·</span>}
              {p.gstin && <span>{p.gstin}</span>}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (p) => (
        <Badge variant="secondary" className="capitalize">
          {p.type}
        </Badge>
      ),
    },
    {
      key: "group",
      header: "Group",
      cell: (p) => <span className="text-sm text-gray-600">{p.groupName || "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (p) =>
        p.status === "inactive" ? (
          <Badge variant="outline" className="text-gray-500">
            Inactive
          </Badge>
        ) : (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>
        ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      cell: (p) => {
        const bal = p.openingBalance ?? 0;
        if (bal === 0) return <span className="text-sm text-gray-400">—</span>;
        return (
          <span
            className={`text-sm font-semibold tabular-nums ${bal > 0 ? "text-green-600" : "text-red-500"}`}
            title={bal > 0 ? "Receivable" : "Payable"}
          >
            {formatINR(Math.abs(bal))}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (p) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Row actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/parties/${p.id}`}>View ledger</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditingParty(p)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => remove.mutate(p.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        title="Parties"
        description={`${parties?.length ?? 0} customers & suppliers`}
        backHref="/"
        backLabel="Dashboard"
      >
        <PartyDialog
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          trigger={
            <Button className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Party
            </Button>
          }
        />
      </PageHeader>

      <DataTable
        columns={columns}
        rows={parties}
        getRowKey={(p) => p.id}
        isLoading={isLoading}
        error={error}
        emptyMessage="No parties yet. Add your first customer to get started."
      />

      {/* Controlled edit dialog */}
      <PartyDialog
        party={editingParty}
        open={!!editingParty}
        onOpenChange={(o) => {
          if (!o) setEditingParty(null);
        }}
      />
    </main>
  );
}
