import { z } from "zod";

/* ============================================================
 * Leafx shared domain types & Zod schemas
 * One source of truth for validation, forms, and API contracts.
 * ============================================================ */

/** GST slabs used in India (percent). Cess is separate & item-specific. */
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28] as const;

/** Indian state codes (GST). Partial seed; extend as needed. */
export const gstStateCodeSchema = z.string().regex(/^\d{2}$/, "State code must be 2 digits");

/** GSTIN format: 2-digit state + 10-char PAN + entity + Z + checksum. */
export const gstinSchema = z
  .string()
  .regex(
    /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/,
    "Invalid GSTIN format"
  );

export const panSchema = z
  .string()
  .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format");

export const phoneSchema = z.string().regex(/^[6-9]\d{9}$/, "Invalid mobile number");

/**
 * An http(s) URL. `z.string().url()` alone accepts ANY scheme the URL constructor
 * parses (javascript:, data:, file:…) — a stored-XSS foothold if ever reflected.
 * Restrict to http/https so uploaded-asset URLs can't smuggle a script scheme.
 */
export const httpUrlSchema = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Must be an http(s) URL");

/* ---------------- Enums ---------------- */

export const partyTypeSchema = z.enum(["customer", "supplier", "both"]);
export type PartyType = z.infer<typeof partyTypeSchema>;

export const itemTypeSchema = z.enum(["product", "service"]);
export type ItemType = z.infer<typeof itemTypeSchema>;

export const transactionTypeSchema = z.enum([
  "sale",
  "purchase",
  "payment_in",
  "payment_out",
  "expense",
  "other_income",
  "estimate",
  "proforma",
  "sale_order",
  "purchase_order",
  "delivery_challan",
  "credit_note",
  "debit_note",
]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const paymentModeSchema = z.enum([
  "cash",
  "cheque",
  "upi",
  "bank_transfer",
  "card",
]);
export type PaymentMode = z.infer<typeof paymentModeSchema>;

/* ---------------- Party ---------------- */

export const partySchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  type: partyTypeSchema.default("customer"),
  groupName: z.string().optional().nullable(),
  gstin: gstinSchema.optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  email: z.string().email().optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  shippingAddress: z.string().optional().nullable(),
  stateCode: gstStateCodeSchema.optional().nullable(),
  /** Opening balance in paise; positive = customer owes you (receivable). */
  openingBalance: z.number().int().default(0),
  creditLimit: z.number().int().nonnegative().optional().nullable(),
  creditPeriodDays: z.number().int().nonnegative().optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
  loyaltyPoints: z.number().int().nonnegative().default(0),
});
export type Party = z.infer<typeof partySchema>;

export const partyStatusSchema = partySchema.shape.status;
export type PartyStatus = z.infer<typeof partyStatusSchema>;

export const createPartySchema = partySchema.omit({ id: true });
export type CreateParty = z.infer<typeof createPartySchema>;

/**
 * GST state codes (first two digits of a GSTIN) → state name.
 * Names match the INDIAN_STATES list used in the party/business forms so the
 * derived value binds directly to a <Select>. Used to auto-fill state from a
 * GSTIN without any network call.
 */
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Dadra and Nagar Haveli and Daman and Diu",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

/** Resolve a state name from a GSTIN's leading state code. */
export const stateNameFromGstin = (gstin: string): string | null =>
  GST_STATE_CODES[gstin.slice(0, 2)] ?? null;

/**
 * Registered-taxpayer details resolved from a GSTIN via the GST network.
 * Normalized shape returned by GET /api/gst/lookup/:gstin.
 */
export const gstinDetailsSchema = z.object({
  gstin: z.string(),
  legalName: z.string(),
  tradeName: z.string().nullable(),
  status: z.string().nullable(),
  /** Taxpayer type, e.g. "Regular" or "Composition". */
  taxpayerType: z.string().nullable(),
  /** Constitution of business, e.g. "Private Limited Company". */
  constitution: z.string().nullable(),
  stateCode: z.string().nullable(),
  state: z.string().nullable(),
  address: z.string().nullable(),
  pincode: z.string().nullable(),
});
export type GstinDetails = z.infer<typeof gstinDetailsSchema>;

/* ---------------- Item ---------------- */

export const itemSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string().min(1),
  type: itemTypeSchema.default("product"),
  categoryId: z.string().uuid().optional().nullable(),
  categoryName: z.string().optional().nullable(),
  category: z.object({
    id: z.string(),
    name: z.string(),
  }).optional().nullable(),
  hsnSac: z.string().optional().nullable(),
  unit: z.string().default("PCS"),
  /** Prices in paise. */
  salePrice: z.number().int().nonnegative().default(0),
  purchasePrice: z.number().int().nonnegative().default(0),
  mrp: z.number().int().nonnegative().optional().nullable(),
  /** GST rate (percent) e.g. 18. */
  taxRate: z.number().default(0),
  /** Additional cess percent. */
  cessRate: z.number().default(0),
  /** true = sale/purchase prices are tax-inclusive. */
  taxInclusive: z.boolean().default(false),
  barcode: z.string().optional().nullable(),
  itemCode: z.string().optional().nullable(),
  /** Wholesale/bulk sale price in paise. */
  wholesalePrice: z.number().int().nonnegative().default(0),
  imageUrl: httpUrlSchema.optional().nullable(),
  trackBatch: z.boolean().default(false),
  trackSerial: z.boolean().default(false),
  openingStock: z.number().default(0),
  minStock: z.number().default(0),
});
export type Item = z.infer<typeof itemSchema>;

export const createItemSchema = itemSchema.omit({ id: true });
export type CreateItem = z.infer<typeof createItemSchema>;

/* ---------------- Business settings ---------------- */

export const updateBusinessSchema = z.object({
  name: z.string().min(1, "Business name is required"),
  gstin: gstinSchema.optional().or(z.literal("")).nullable(),
  pan: panSchema.optional().or(z.literal("")).nullable(),
  stateCode: gstStateCodeSchema.optional().or(z.literal("")).nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  jurisdiction: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccountNo: z.string().optional().nullable(),
  bankIfsc: z.string().optional().nullable(),
  bankBranch: z.string().optional().nullable(),
  // branding & extended profile
  logoUrl: httpUrlSchema.optional().or(z.literal("")).nullable(),
  signatureUrl: httpUrlSchema.optional().or(z.literal("")).nullable(),
  pincode: z.string().max(10).optional().nullable(),
  stateName: z.string().optional().nullable(),
  businessCategory: z.string().optional().nullable(),
  booksBeginDate: z.coerce.date().optional().nullable(),
});
export type UpdateBusiness = z.infer<typeof updateBusinessSchema>;

/* ---------------- Business settings (preferences layer) ----------------
 * A single normalized JSON blob on Business.settings. EVERY field has a
 * `.default(...)`, so `settingsSchema.parse({})` yields a complete, typed object
 * — reads never see `undefined`, and old rows with a null/partial blob are
 * healed on read. Keys the invoice builder / print / GST logic actually honor in
 * Milestone 1 are marked [F]; the rest are stored-but-inert (wired later).
 */

const roundOffTo = z.union([z.literal(1), z.literal(10), z.literal(100)]);

// Each group is a named object with per-leaf defaults. These are reused by BOTH
// the read schema (each wrapped in `.default({})` so a null/partial blob heals to
// a full object) and the patch schema (deep-partialled so an absent key stays
// absent — never resurrected to its default, which would clobber a sibling).
const enabledDocsObj = z.object({
  estimate: z.boolean().default(true), // [F]
  proforma: z.boolean().default(false), // [F]
  saleOrder: z.boolean().default(true), // [F]
  purchaseOrder: z.boolean().default(true), // [F]
  deliveryChallan: z.boolean().default(true), // [F]
  otherIncome: z.boolean().default(false),
  fixedAssets: z.boolean().default(false),
});
const generalObj = z.object({
  currency: z.string().default("INR"), // [F]
  amountDecimals: z.number().int().min(0).max(3).default(2), // [F]
  showGstin: z.boolean().default(true), // [F]
  stopSaleOnNegativeStock: z.boolean().default(false), // [F]
  enabledDocs: enabledDocsObj.default({}),
});
const roundOffObj = z.object({
  enabled: z.boolean().default(true), // [F]
  mode: z.enum(["nearest", "up", "down"]).default("nearest"),
  to: roundOffTo.default(1), // [F]
});
const transactionObj = z.object({
  showInvoiceNo: z.boolean().default(true), // [F]
  taxInclusiveByDefault: z.boolean().default(false), // [F]
  roundOff: roundOffObj.default({}),
  dueDatesAndTerms: z.boolean().default(false), // [F]
  termsAndConditions: z.string().default(""), // [F]
  enableEwayBill: z.boolean().default(false), // [F]
  transportDetails: z.boolean().default(false), // [F]
  additionalCharges: z.boolean().default(false), // [F]
});
const taxesObj = z.object({
  enableGst: z.boolean().default(true), // [F]
  enableHsn: z.boolean().default(true), // [F]
  additionalCess: z.boolean().default(false), // [F]
  reverseCharge: z.boolean().default(false), // [F]
  placeOfSupply: z.boolean().default(true), // [F]
  compositeScheme: z.boolean().default(false),
  enableTcs: z.boolean().default(false), // [F]
  enableTds: z.boolean().default(false), // [F]
});
const printObj = z.object({
  theme: z.enum(["tally", "gst1"]).default("tally"), // [F]
  paperSize: z.enum(["A4"]).default("A4"), // [F]
  showLogo: z.boolean().default(true), // [F]
  showGstinOnSale: z.boolean().default(true), // [F]
  showReceivedAmount: z.boolean().default(true), // [F]
  showBalanceAmount: z.boolean().default(true), // [F]
  showTaxDetails: z.boolean().default(true), // [F]
  showAmountInWords: z.boolean().default(true), // [F]
  showSignature: z.boolean().default(true), // [F]
});
const partyObj = z.object({
  shippingAddress: z.boolean().default(false), // [F]
  managePartyStatus: z.boolean().default(false),
  loyaltyPoints: z.boolean().default(false),
});
const itemObj = z.object({
  stockMaintenance: z.boolean().default(true), // [F]
  showLowStockDialog: z.boolean().default(true), // [F]
  itemCategory: z.boolean().default(true), // [F]
  wholesalePrice: z.boolean().default(false), // [F]
  description: z.boolean().default(true), // [F]
  itemWiseTax: z.boolean().default(true), // [F]
  itemWiseDiscount: z.boolean().default(true), // [F]
  qtyDecimals: z.number().int().min(0).max(3).default(2), // [F]
});

export const settingsSchema = z
  .object({
    general: generalObj.default({}),
    transaction: transactionObj.default({}),
    taxes: taxesObj.default({}),
    print: printObj.default({}),
    party: partyObj.default({}),
    item: itemObj.default({}),
  })
  .default({});
export type BusinessSettings = z.infer<typeof settingsSchema>;

/**
 * PATCH merge-patch schema — clients may send any subset of groups/keys. Built by
 * hand (not `deepPartial()`, which can't see through `ZodDefault` wrappers) so an
 * OMITTED key is truly absent from the parsed output and the server's deep-merge
 * leaves the stored value untouched. Nested groups (enabledDocs, roundOff) are
 * partialled too so patching one nested key never resets its siblings.
 */
export const settingsPatchSchema = z
  .object({
    general: generalObj
      .extend({ enabledDocs: enabledDocsObj.partial().optional() })
      .partial()
      .optional(),
    transaction: transactionObj
      .extend({ roundOff: roundOffObj.partial().optional() })
      .partial()
      .optional(),
    taxes: taxesObj.partial().optional(),
    print: printObj.partial().optional(),
    party: partyObj.partial().optional(),
    item: itemObj.partial().optional(),
  })
  .strict();
export type BusinessSettingsPatch = z.infer<typeof settingsPatchSchema>;

/** Fully-defaulted settings object (single source of default truth). */
export const defaultSettings = (): BusinessSettings => settingsSchema.parse({});

/* ---------------- Number series (per-document prefixes) ---------------- */

/** Canonical editable document series + their default prefixes. */
export const NUMBER_SERIES = [
  { key: "sale", defaultPrefix: "INV", label: "Sale Invoice" },
  { key: "purchase", defaultPrefix: "PUR", label: "Purchase Bill" },
  { key: "expense", defaultPrefix: "EXP", label: "Expense" },
  { key: "estimate", defaultPrefix: "EST", label: "Estimate" },
  { key: "proforma", defaultPrefix: "PRO", label: "Proforma Invoice" },
  { key: "sale_order", defaultPrefix: "SO", label: "Sale Order" },
  { key: "purchase_order", defaultPrefix: "PO", label: "Purchase Order" },
  { key: "delivery_challan", defaultPrefix: "DC", label: "Delivery Challan" },
  { key: "credit_note", defaultPrefix: "CN", label: "Credit Note" },
  { key: "debit_note", defaultPrefix: "DN", label: "Debit Note" },
] as const;
export type NumberSeriesKey = (typeof NUMBER_SERIES)[number]["key"];
const numberSeriesKeys = NUMBER_SERIES.map((s) => s.key) as [NumberSeriesKey, ...NumberSeriesKey[]];

export const updateSeriesSchema = z.object({
  key: z.enum(numberSeriesKeys),
  /** Prefix, e.g. "INV". Letters/digits/dash/slash only. */
  prefix: z
    .string()
    .trim()
    .min(1, "Prefix required")
    .max(10, "Max 10 chars")
    .regex(/^[A-Za-z0-9/-]+$/, "Only letters, digits, - and /"),
});
export type UpdateSeries = z.infer<typeof updateSeriesSchema>;

/* ---------------- Cheques ---------------- */

export const chequeDirectionSchema = z.enum(["received", "issued"]);
export type ChequeDirection = z.infer<typeof chequeDirectionSchema>;
export const chequeStatusSchema = z.enum(["open", "deposited", "cleared", "bounced"]);
export type ChequeStatus = z.infer<typeof chequeStatusSchema>;

export const createChequeSchema = z.object({
  partyId: z.string().uuid().nullish(),
  bankAccountId: z.string().uuid().nullish(),
  chequeNo: z.string().trim().min(1, "Cheque no. required").max(30),
  amount: z.number().int().positive("Amount must be > 0"), // paise
  direction: chequeDirectionSchema,
  date: z.coerce.date().optional(),
  dueDate: z.coerce.date().nullish(),
  notes: z.string().max(500).nullish(),
});
export type CreateCheque = z.infer<typeof createChequeSchema>;

export const chequeStatusUpdateSchema = z.object({ status: chequeStatusSchema });

/* ---------------- Loans ---------------- */

export const loanEntryKindSchema = z.enum(["disbursement", "emi", "charge"]);
export type LoanEntryKind = z.infer<typeof loanEntryKindSchema>;

export const createLoanSchema = z.object({
  lender: z.string().trim().min(1, "Lender required").max(120),
  principal: z.number().int().nonnegative(), // paise
  interestRate: z.number().min(0).max(100).nullish(),
  startDate: z.coerce.date().optional(),
  notes: z.string().max(500).nullish(),
});
export type CreateLoan = z.infer<typeof createLoanSchema>;

export const createLoanEntrySchema = z.object({
  amount: z.number().int().positive(), // paise
  kind: loanEntryKindSchema,
  date: z.coerce.date().optional(),
  note: z.string().max(200).nullish(),
});
export type CreateLoanEntry = z.infer<typeof createLoanEntrySchema>;

/* ---------------- Batch & serial tracking ---------------- */

export const createBatchSchema = z.object({
  batchNo: z.string().trim().min(1, "Batch no. required").max(40),
  expiryDate: z.coerce.date().nullish(),
  mfgDate: z.coerce.date().nullish(),
  qty: z.number().nonnegative().default(0),
});
export type CreateBatch = z.infer<typeof createBatchSchema>;

export const createSerialSchema = z.object({
  serial: z.string().trim().min(1, "Serial required").max(60),
});
export type CreateSerial = z.infer<typeof createSerialSchema>;

/* ---------------- Invoice / Sale (request payload) ---------------- */

export const invoiceLineInputSchema = z.object({
  itemId: z.string().uuid().nullish(),
  description: z.string().min(1, "Description is required"),
  hsnSac: z.string().nullish(),
  qty: z.number().positive("Qty must be > 0"),
  unit: z.string().default("PCS"),
  /** Unit rate in paise. */
  rate: z.number().int().nonnegative(),
  taxRate: z.number().default(0),
  cessRate: z.number().default(0),
  discountPercent: z.number().min(0).max(100).default(0),
  taxInclusive: z.boolean().default(false),
});
export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>;

/** One additional (post-tax) charge line, e.g. freight or packing. */
export const additionalChargeSchema = z.object({
  label: z.string().min(1).max(60),
  /** Amount in paise. */
  amount: z.number().int().nonnegative(),
});
export type AdditionalCharge = z.infer<typeof additionalChargeSchema>;

/** Invoice-level extras ("More options") — all optional, GST-neutral defaults. */
export const invoiceExtrasSchema = z.object({
  ewayBillNo: z.string().max(30).nullish(),
  transporterName: z.string().max(120).nullish(),
  vehicleNo: z.string().max(20).nullish(),
  transportDistanceKm: z.number().int().nonnegative().nullish(),
  additionalCharges: z.array(additionalChargeSchema).max(20).default([]),
  /** Flat invoice discount in paise (post-tax). */
  discountFlat: z.number().int().nonnegative().default(0),
  tcsRate: z.number().min(0).max(100).default(0),
  tdsRate: z.number().min(0).max(100).default(0),
  reverseCharge: z.boolean().default(false),
  termsConditions: z.string().max(2000).nullish(),
});
export type InvoiceExtras = z.infer<typeof invoiceExtrasSchema>;

export const createInvoiceSchema = z
  .object({
    partyId: z.string().uuid().nullish(),
    date: z.coerce.date().optional(),
    dueDate: z.coerce.date().nullish(),
    notes: z.string().nullish(),
    lines: z.array(invoiceLineInputSchema).min(1, "Add at least one line item"),
  })
  .merge(invoiceExtrasSchema);
export type CreateInvoice = z.infer<typeof createInvoiceSchema>;

/* ---------------- Payments (money in / out) ---------------- */

export const createPaymentSchema = z.object({
  partyId: z.string().uuid(),
  type: z.enum(["payment_in", "payment_out"]),
  /** Amount in paise. */
  amount: z.number().int().positive("Amount must be > 0"),
  paymentMode: paymentModeSchema.default("cash"),
  referenceNo: z.string().nullish(),
  date: z.coerce.date().optional(),
  notes: z.string().nullish(),
});
export type CreatePayment = z.infer<typeof createPaymentSchema>;

/* ---------------- Purchases & Expenses ---------------- */

// A purchase bill has the same line shape as a sale invoice.
export const createPurchaseSchema = z.object({
  partyId: z.string().uuid().nullish(),
  referenceNo: z.string().nullish(), // supplier's bill number
  date: z.coerce.date().optional(),
  dueDate: z.coerce.date().nullish(),
  notes: z.string().nullish(),
  lines: z.array(invoiceLineInputSchema).min(1, "Add at least one line item"),
});
export type CreatePurchase = z.infer<typeof createPurchaseSchema>;

export const createExpenseSchema = z.object({
  category: z.string().min(1, "Category is required"),
  /** Total amount in paise. */
  amount: z.number().int().positive("Amount must be > 0"),
  partyId: z.string().uuid().nullish(),
  taxRate: z.number().default(0),
  paymentMode: paymentModeSchema.default("cash"),
  date: z.coerce.date().optional(),
  notes: z.string().nullish(),
});
export type CreateExpense = z.infer<typeof createExpenseSchema>;

/* ---------------- Documents (estimate/order/challan/notes) ---------------- */

export const documentTypeSchema = z.enum([
  "estimate",
  "proforma",
  "sale_order",
  "purchase_order",
  "delivery_challan",
  "credit_note",
  "debit_note",
]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const createDocumentSchema = z.object({
  type: documentTypeSchema,
  partyId: z.string().uuid().nullish(),
  referenceNo: z.string().nullish(),
  date: z.coerce.date().optional(),
  notes: z.string().nullish(),
  lines: z.array(invoiceLineInputSchema).min(1, "Add at least one line item"),
});
export type CreateDocument = z.infer<typeof createDocumentSchema>;

/* ---------------- Employee ---------------- */

export const employeeSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  code: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional().nullable(),
  email: z.string().email().or(z.literal("")).optional().nullable(),
  role: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  salary: z.number().int().nonnegative().optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
  joiningDate: z.string().optional().nullable(),
  leavingDate: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  panNo: z.string().optional().nullable(),
  aadhaarNo: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  accountNo: z.string().optional().nullable(),
  ifscCode: z.string().optional().nullable(),
  upiId: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),
});
export type Employee = z.infer<typeof employeeSchema>;

export const createEmployeeSchema = employeeSchema.omit({ id: true });
export type CreateEmployee = z.infer<typeof createEmployeeSchema>;

export const employeeAttendanceSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  employeeId: z.string().uuid(),
  date: z.string(),
  status: z.enum(["present", "absent", "half_day", "paid_leave"]),
  note: z.string().optional().nullable(),
});
export type EmployeeAttendance = z.infer<typeof employeeAttendanceSchema>;

export const createEmployeeAttendanceSchema = employeeAttendanceSchema.omit({ id: true, businessId: true });
export type CreateEmployeeAttendance = z.infer<typeof createEmployeeAttendanceSchema>;

export const employeePaymentSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  employeeId: z.string().uuid(),
  amount: z.number().int().positive("Amount must be positive"),
  type: z.enum(["salary", "advance", "bonus", "deduction"]),
  paymentMode: z.enum(["cash", "bank_transfer", "upi", "cheque"]).default("cash"),
  date: z.string(),
  monthPeriod: z.string().optional().nullable(),
  referenceNo: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});
export type EmployeePayment = z.infer<typeof employeePaymentSchema>;

export const createEmployeePaymentSchema = employeePaymentSchema.omit({ id: true, businessId: true });
export type CreateEmployeePayment = z.infer<typeof createEmployeePaymentSchema>;

