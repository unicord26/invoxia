"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Search, Camera, Settings, X, Percent, IndianRupee } from "lucide-react";
import { GST_RATES, type Item } from "@invoixe/types";
import { api } from "../../../lib/api";
import { PageHeader } from "../../../components/page-header";
import { MoneyInput } from "../../../components/money-input";
import { ImageUpload } from "../../../components/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
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

const UNITS = ["PCS", "KG", "GM", "LTR", "ML", "BOX", "MTR", "DOZ", "PKT"];
const CATEGORIES = ["General", "Services", "Raw Material", "Finished Goods"];

const businessId = () =>
  (typeof window !== "undefined" && localStorage.getItem("leafx.businessId")) || "shared";

const formSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(["product", "service"]),
  hsnSac: z.string(),
  unit: z.string(),
  itemCode: z.string(),
  category: z.string(),
  taxRate: z.number(),
  taxInclusive: z.boolean(),
  salePrice: z.number().int().nonnegative().nullable(),
  wholesalePrice: z.number().int().nonnegative().nullable(),
  wholesaleTaxInclusive: z.boolean(),
  purchasePrice: z.number().int().nonnegative().nullable(),
  purchaseTaxInclusive: z.boolean(),
  discountValue: z.number().nullable(),
  discountType: z.enum(["percentage", "amount"]),
  imageUrl: z.string().nullable(),
  openingStock: z.number().nullable(),
  atPrice: z.number().nullable(),
  minStock: z.number().nullable(),
  asOfDate: z.string(),
  location: z.string(),
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
  type: "product",
  hsnSac: "",
  unit: "PCS",
  itemCode: "",
  category: "General",
  taxRate: 18,
  taxInclusive: false,
  salePrice: null,
  wholesalePrice: null,
  wholesaleTaxInclusive: false,
  purchasePrice: null,
  purchaseTaxInclusive: false,
  discountValue: null,
  discountType: "percentage",
  imageUrl: null,
  openingStock: null,
  atPrice: null,
  minStock: null,
  asOfDate: getTodayDateString(),
  location: "",
};

export default function NewItemPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showWholesale, setShowWholesale] = useState(false);
  const [activeTab, setActiveTab] = useState("pricing");

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: DEFAULTS });
  const type = form.watch("type");

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      api.post<Item>("/api/items", {
        name: v.name.trim(),
        type: v.type,
        hsnSac: v.hsnSac.trim() || null,
        unit: v.unit,
        itemCode: v.itemCode.trim() || null,
        taxRate: v.taxRate,
        taxInclusive: v.taxInclusive,
        salePrice: v.salePrice ?? 0,
        wholesalePrice: v.wholesalePrice ?? 0,
        purchasePrice: v.purchasePrice ?? 0,
        imageUrl: v.imageUrl || null,
        trackBatch: false,
        trackSerial: false,
        openingStock: v.type === "product" ? v.openingStock ?? 0 : 0,
        minStock: v.type === "product" ? v.minStock ?? 0 : 0,
      }),
    onSuccess: (it) => {
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success(`Added ${it.name}`);
      router.push("/items");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add item"),
  });

  return (
    <Form {...form}>
      <main className="mx-auto max-w-5xl px-6 py-6">
        
        {/* Custom Header Row mimicking the screenshot */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-6">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-gray-800">Add Item</h1>
            
            {/* Product / Service Switcher */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-semibold transition-colors", field.value === "product" ? "text-blue-600" : "text-gray-400")}>
                    Product
                  </span>
                  <Switch
                    checked={field.value === "service"}
                    onCheckedChange={(c) => {
                      const newType = c ? "service" : "product";
                      field.onChange(newType);
                      if (newType === "service") {
                        setActiveTab("pricing");
                      }
                    }}
                    className="data-[state=checked]:bg-blue-600"
                  />
                  <span className={cn("text-xs font-semibold transition-colors", field.value === "service" ? "text-blue-600" : "text-gray-400")}>
                    Service
                  </span>
                </div>
              )}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-700" type="button" aria-label="Item Settings">
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-gray-500 hover:text-gray-700"
              type="button"
              onClick={() => router.push("/items")}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Upper Form Fields (Layout matched to Vyapar) */}
        <div className="bg-white border border-gray-100 rounded-xl shadow-xs p-6 mb-6">
          <div className="grid grid-cols-[1.5fr_1.2fr_1fr_1.2fr] gap-4 items-start">
            
            {/* Col 1: Item Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <Input
                      placeholder={type === "service" ? "Service Name *" : "Item Name *"}
                      {...field}
                      className="h-10 placeholder:text-gray-400 text-sm border-gray-300"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* Col 2: HSN */}
            <FormField
              control={form.control}
              name="hsnSac"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder={type === "service" ? "Service HSN" : "Item HSN"}
                        {...field}
                        className="h-10 placeholder:text-gray-400 text-sm border-gray-300 pr-9"
                      />
                      <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* Col 3: Select Unit (dropdown styled exactly as button) */}
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 font-semibold text-xs rounded transition-colors w-full justify-center">
                        <SelectValue placeholder="Select Unit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u} className="text-sm">{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* Col 4: Image Upload */}
            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormControl>
                    <ImageUpload
                      value={field.value}
                      onChange={field.onChange}
                      pathPrefix={`items/${businessId()}`}
                      className="w-full"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-[1.5fr_1.2fr_2.2fr] gap-4 items-start mt-4">
            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 text-sm border-gray-300">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* Item Code */}
            <FormField
              control={form.control}
              name="itemCode"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormControl>
                    <div className="flex gap-2 items-center">
                      <Input
                        placeholder={type === "service" ? "Service Code" : "Item Code"}
                        {...field}
                        className="h-10 placeholder:text-gray-400 text-sm border-gray-300 flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded px-3 text-xs font-semibold shrink-0"
                        onClick={() => {
                          const code = `ITEM-${Math.floor(1000 + Math.random() * 9000)}`;
                          form.setValue("itemCode", code);
                        }}
                      >
                        Assign Code
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <div />
          </div>
        </div>

        {/* Tab Selection */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-gray-200 mb-6 bg-white rounded-lg shadow-xs px-2">
            <TabsList className="bg-transparent h-auto p-0 gap-0 rounded-none">
              <TabsTrigger
                value="pricing"
                className="
                  rounded-none border-b-2 border-transparent
                  data-[state=active]:border-red-600 data-[state=active]:text-red-600
                  data-[state=active]:bg-transparent data-[state=active]:shadow-none
                  px-6 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700
                  transition-colors
                "
              >
                Pricing
              </TabsTrigger>
              {type === "product" && (
                <TabsTrigger
                  value="stock"
                  className="
                    rounded-none border-b-2 border-transparent
                    data-[state=active]:border-red-600 data-[state=active]:text-red-600
                    data-[state=active]:bg-transparent data-[state=active]:shadow-none
                    px-6 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700
                    transition-colors
                  "
                >
                  Stock
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Pricing Tab Content */}
          <TabsContent value="pricing" className="m-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              
              {/* Box 1: Sale Price (takes up left column, or full width if Service) */}
              <div className={cn("bg-white border border-gray-200 rounded-lg p-5 shadow-xs space-y-4", type === "service" && "md:col-span-2")}>
                <h3 className="text-sm font-bold text-gray-700">Sale Price</h3>
                
                {/* Row 1: Sale Price Input + With/Without Tax Select */}
                <div className="grid grid-cols-[1.5fr_1fr] gap-4 items-end">
                  <FormField
                    control={form.control}
                    name="salePrice"
                    render={({ field }) => (
                      <FormItem className="space-y-0.5">
                        <FormControl>
                          <MoneyInput value={field.value} onChange={field.onChange} placeholder="Sale Price" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="taxInclusive"
                    render={({ field }) => (
                      <FormItem className="space-y-0.5">
                        <Select value={field.value ? "with" : "without"} onValueChange={(v) => field.onChange(v === "with")}>
                          <FormControl>
                            <SelectTrigger className="h-10 text-sm border-gray-300 bg-gray-50/50">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="without" className="text-sm">Without Tax</SelectItem>
                            <SelectItem value="with" className="text-sm">With Tax</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Row 2: Discount Input + Percentage/Amount Select */}
                <div className="grid grid-cols-[1.5fr_1fr] gap-4 items-end">
                  <FormField
                    control={form.control}
                    name="discountValue"
                    render={({ field }) => (
                      <FormItem className="space-y-0.5">
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Disc. On Sale Price..."
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                            className="h-10 border-gray-300 text-sm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="discountType"
                    render={({ field }) => (
                      <FormItem className="space-y-0.5">
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 text-sm border-gray-300 bg-gray-50/50">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="percentage" className="text-sm flex items-center gap-1">
                              Percentage
                            </SelectItem>
                            <SelectItem value="amount" className="text-sm flex items-center gap-1">
                              Amount
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Wholesale toggle link */}
                <div className="pt-2">
                  {!showWholesale ? (
                    <button
                      type="button"
                      onClick={() => setShowWholesale(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                    >
                      + Add Wholesale Price
                    </button>
                  ) : (
                    <div className="border-t border-dashed border-gray-200 pt-4 mt-2 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-600">Wholesale Price</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowWholesale(false);
                            form.setValue("wholesalePrice", null);
                          }}
                          className="text-[10px] text-red-500 hover:underline font-medium"
                        >
                          Remove
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-[1.5fr_1fr] gap-4 items-end">
                        <FormField
                          control={form.control}
                          name="wholesalePrice"
                          render={({ field }) => (
                            <FormItem className="space-y-0.5">
                              <FormControl>
                                <MoneyInput value={field.value} onChange={field.onChange} placeholder="Wholesale Price" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="wholesaleTaxInclusive"
                          render={({ field }) => (
                            <FormItem className="space-y-0.5">
                              <Select value={field.value ? "with" : "without"} onValueChange={(v) => field.onChange(v === "with")}>
                                <FormControl>
                                  <SelectTrigger className="h-10 text-sm border-gray-300 bg-gray-50/50">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="without" className="text-sm">Without Tax</SelectItem>
                                  <SelectItem value="with" className="text-sm">With Tax</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Box 2: Purchase Price (Only for Product) */}
              {type === "product" && (
                <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs space-y-4 min-h-[178px]">
                  <h3 className="text-sm font-bold text-gray-700">Purchase Price</h3>
                  
                  <div className="grid grid-cols-[1.5fr_1fr] gap-4 items-end">
                    <FormField
                      control={form.control}
                      name="purchasePrice"
                      render={({ field }) => (
                        <FormItem className="space-y-0.5">
                          <FormControl>
                            <MoneyInput value={field.value} onChange={field.onChange} placeholder="Purchase Price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="purchaseTaxInclusive"
                      render={({ field }) => (
                        <FormItem className="space-y-0.5">
                          <Select value={field.value ? "with" : "without"} onValueChange={(v) => field.onChange(v === "with")}>
                            <FormControl>
                              <SelectTrigger className="h-10 text-sm border-gray-300 bg-gray-50/50">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="without" className="text-sm">Without Tax</SelectItem>
                              <SelectItem value="with" className="text-sm">With Tax</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Box 3: Taxes */}
              <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-xs space-y-4 min-h-[178px]">
                <h3 className="text-sm font-bold text-gray-700">Taxes</h3>
                
                <FormField
                  control={form.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tax Rate</FormLabel>
                      <Select
                        value={String(field.value)}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 text-sm border-gray-300 bg-gray-50/50">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0" className="text-sm">None</SelectItem>
                          {GST_RATES.filter(r => r > 0).map((r) => (
                            <SelectItem key={r} value={String(r)} className="text-sm">
                              G.S.T. @ {r}%
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

            </div>
          </TabsContent>

          {/* Stock Tab Content (Only for Product) */}
          {type === "product" && (
            <TabsContent value="stock" className="m-0">
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                
                <FormField
                  control={form.control}
                  name="openingStock"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold text-gray-500">Opening Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="Opening Quantity"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                          className="h-10 border-gray-300 text-sm"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="atPrice"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold text-gray-500">At Price</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="At Price"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                          className="h-10 border-gray-300 text-sm"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="asOfDate"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold text-gray-500">As Of Date</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="h-10 border-gray-300 text-sm"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="minStock"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold text-gray-500">Min Stock To Maintain</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="Min Stock To Maintain"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                          className="h-10 border-gray-300 text-sm"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-semibold text-gray-500">Location</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Location"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="h-10 border-gray-300 text-sm"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

              </div>
            </TabsContent>
          )}
        </Tabs>

        {/* Bottom Form Actions */}
        <div className="flex justify-end gap-3 border-t border-gray-200 mt-8 pt-5">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded px-6 border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-bold"
            onClick={() => {
              form.reset(DEFAULTS);
              router.push("/items");
            }}
          >
            Save &amp; New
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={create.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-8 text-xs font-bold"
            onClick={() => form.handleSubmit((v) => create.mutate(v))()}
          >
            {create.isPending ? "Saving…" : "Save"}
          </Button>
        </div>

      </main>
    </Form>
  );
}
