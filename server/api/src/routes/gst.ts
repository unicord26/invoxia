import { Router } from "express";
import { prisma } from "@invoixe/db";
import { gstinSchema, stateNameFromGstin } from "@invoixe/types";
import { getUserBusinessId } from "../lib/business";

export const gstRouter = Router();

// GET /api/gst/lookup/:gstin — resolve registered-taxpayer details from the GST
// network so the party form can auto-fill name, type, state and address.
//
// Provider is configurable via env; the default request/response shape follows
// Appyflow's verifyGST API (https://appyflow.in/gst-api). Set GST_API_KEY (and
// optionally GST_API_URL) to enable. Without a key the endpoint reports
// "gst_lookup_unconfigured" and the client falls back to offline state fill.
gstRouter.get("/lookup/:gstin", async (req, res) => {
  const gstin = String(req.params.gstin ?? "").toUpperCase().trim();
  if (!gstinSchema.safeParse(gstin).success) {
    return res.status(400).json({ error: "invalid_gstin" });
  }

  const key = process.env.GST_API_KEY;
  const baseUrl = process.env.GST_API_URL ?? "https://appyflow.in/api/verifyGST";
  if (!key) return res.status(503).json({ error: "gst_lookup_unconfigured" });

  try {
    const url = `${baseUrl}?gstNo=${encodeURIComponent(gstin)}&key_secret=${encodeURIComponent(key)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    const data: any = await r.json().catch(() => ({}));

    // Appyflow signals failure with { error: true, message } even on HTTP 200.
    if (!r.ok || data?.error) {
      return res
        .status(502)
        .json({ error: "gst_lookup_failed", message: data?.message ?? `HTTP ${r.status}` });
    }

    const t = data?.taxpayerInfo;
    if (!t) return res.status(404).json({ error: "gstin_not_found" });

    const addr = t?.pradr?.addr ?? {};
    const address = [addr.bno, addr.bnm, addr.flno, addr.st, addr.loc, addr.city, addr.dst, addr.pncd]
      .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean)
      .join(", ");

    res.json({
      gstin: t.gstin ?? gstin,
      legalName: t.lgnm ?? "",
      tradeName: t.tradeNam ?? null,
      status: t.sts ?? null,
      taxpayerType: t.dty ?? null,
      constitution: t.ctb ?? null,
      stateCode: gstin.slice(0, 2),
      state: (typeof addr.stcd === "string" && addr.stcd.trim()) || stateNameFromGstin(gstin),
      address: address || null,
      pincode: (typeof addr.pncd === "string" && addr.pncd.trim()) || null,
    });
  } catch (e) {
    res
      .status(502)
      .json({ error: "gst_lookup_failed", message: e instanceof Error ? e.message : "unknown" });
  }
});

// paise -> rupees number (GST portal expects rupees with 2 decimals)
const rs = (p: number) => Math.round(p) / 100;
const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

// GET /api/gst/gstr1?month=MM&year=YYYY — GSTR-1 return JSON (B2B + B2C summary)
gstRouter.get("/gstr1", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const now = new Date();
  const month = Number(req.query.month ?? now.getMonth() + 1);
  const year = Number(req.query.year ?? now.getFullYear());
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);

  const invoices = await prisma.transaction.findMany({
    where: { businessId, type: "sale", deletedAt: null, date: { gte: from, lt: to } },
    include: { lines: true },
    orderBy: { date: "asc" },
  });

  // B2B: invoices with a buyer GSTIN, grouped by counter-party GSTIN
  const b2bMap = new Map<string, any>();
  const b2cs: any[] = [];
  for (const inv of invoices) {
    const itms = inv.lines.map((l, i) => ({
      num: i + 1,
      itm_det: {
        rt: l.taxRate,
        txval: rs(l.taxable),
        camt: rs(l.cgst),
        samt: rs(l.sgst),
        iamt: rs(l.igst),
        csamt: rs(l.cess),
      },
    }));
    if (inv.partyGstin) {
      const entry = b2bMap.get(inv.partyGstin) ?? { ctin: inv.partyGstin, inv: [] };
      entry.inv.push({
        inum: inv.number,
        idt: ddmmyyyy(inv.date),
        val: rs(inv.grandTotal),
        pos: inv.placeOfSupply ?? business.stateCode,
        rchrg: inv.reverseCharge ? "Y" : "N",
        inv_typ: "R",
        itms,
      });
      b2bMap.set(inv.partyGstin, entry);
    } else {
      b2cs.push({
        sply_ty: inv.interState ? "INTER" : "INTRA",
        pos: inv.placeOfSupply ?? business.stateCode,
        typ: "OE",
        txval: rs(inv.subTotal),
        rt: inv.lines[0]?.taxRate ?? 0,
        camt: rs(inv.cgst),
        samt: rs(inv.sgst),
        iamt: rs(inv.igst),
        csamt: rs(inv.cess),
      });
    }
  }

  res.json({
    gstin: business.gstin ?? "",
    fp: `${String(month).padStart(2, "0")}${year}`,
    gt: rs(invoices.reduce((s, i) => s + i.grandTotal, 0)),
    b2b: [...b2bMap.values()],
    b2cs,
  });
});

// GET /api/gst/einvoice/:id — NIC e-invoice JSON payload for one invoice
gstRouter.get("/einvoice/:id", async (req, res) => {
  const businessId = await getUserBusinessId(req.authUser!);
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const inv = await prisma.transaction.findFirst({
    where: { id: req.params.id, businessId, type: "sale", deletedAt: null },
    include: { party: true, lines: { orderBy: { lineNo: "asc" } } },
  });
  if (!inv) return res.status(404).json({ error: "not_found" });

  const payload = {
    Version: "1.1",
    TranDtls: { TaxSch: "GST", SupTyp: "B2B", RegRev: inv.reverseCharge ? "Y" : "N" },
    DocDtls: { Typ: "INV", No: inv.number, Dt: ddmmyyyy(inv.date) },
    SellerDtls: {
      Gstin: business.gstin ?? "",
      LglNm: business.name,
      Addr1: business.address ?? "",
      Loc: business.jurisdiction ?? "",
      Stcd: business.stateCode ?? "",
    },
    BuyerDtls: {
      Gstin: inv.partyGstin ?? "URP",
      LglNm: inv.partyName ?? "Unregistered",
      Pos: inv.placeOfSupply ?? business.stateCode ?? "",
      Stcd: inv.party?.stateCode ?? business.stateCode ?? "",
    },
    ItemList: inv.lines.map((l) => ({
      SlNo: String(l.lineNo),
      PrdDesc: l.description,
      HsnCd: l.hsnSac ?? "",
      Qty: l.qty,
      Unit: l.unit,
      UnitPrice: rs(l.rate),
      TotAmt: rs(l.taxable),
      AssAmt: rs(l.taxable),
      GstRt: l.taxRate,
      CgstAmt: rs(l.cgst),
      SgstAmt: rs(l.sgst),
      IgstAmt: rs(l.igst),
      TotItemVal: rs(l.lineTotal),
    })),
    ValDtls: {
      AssVal: rs(inv.subTotal),
      CgstVal: rs(inv.cgst),
      SgstVal: rs(inv.sgst),
      IgstVal: rs(inv.igst),
      RndOffAmt: rs(inv.roundOff),
      TotInvVal: rs(inv.grandTotal),
    },
    // NOTE: obtaining an IRN + signed QR requires submitting this to a GSP/IRP with
    // production credentials. That integration is a deploy-time configuration.
    _status: "payload_ready_not_submitted",
  };
  res.json(payload);
});
