import {
  BadRequestException, Controller, Get, HttpException, Injectable, Module, NotFoundException, Param, Query, UseGuards,
} from "@nestjs/common";
import { PrismaClient } from "@invoixe/db";
import { gstinSchema, stateNameFromGstin } from "@invoixe/types";
import type { AuthUser } from "../lib/auth";
import { getUserBusinessId } from "../lib/business";
import { CurrentUser, SupabaseAuthGuard } from "../common/supabase-auth.guard";

// paise -> rupees number (GST portal expects rupees with 2 decimals)
const rs = (p: number) => Math.round(p) / 100;
const ddmmyyyy = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

@Injectable()
export class GstService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Resolve registered-taxpayer details from the GST network so the party form
   * can auto-fill name, type, state and address.
   *
   * Provider is configurable via env; the default request/response shape follows
   * Appyflow's verifyGST API (https://appyflow.in/gst-api). Set GST_API_KEY (and
   * optionally GST_API_URL) to enable. Without a key the endpoint reports
   * "gst_lookup_unconfigured" and the client falls back to offline state fill.
   */
  async lookup(rawGstin: string) {
    const gstin = String(rawGstin ?? "").toUpperCase().trim();
    if (!gstinSchema.safeParse(gstin).success) throw new BadRequestException({ error: "invalid_gstin" });

    const key = process.env.GST_API_KEY;
    const baseUrl = process.env.GST_API_URL ?? "https://appyflow.in/api/verifyGST";
    if (!key) throw new HttpException({ error: "gst_lookup_unconfigured" }, 503);

    try {
      const url = `${baseUrl}?gstNo=${encodeURIComponent(gstin)}&key_secret=${encodeURIComponent(key)}`;
      const r = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      const data: any = await r.json().catch(() => ({}));

      // Appyflow signals failure with { error: true, message } even on HTTP 200.
      if (!r.ok || data?.error) {
        throw new HttpException({ error: "gst_lookup_failed", message: data?.message ?? `HTTP ${r.status}` }, 502);
      }

      const t = data?.taxpayerInfo;
      if (!t) throw new NotFoundException({ error: "gstin_not_found" });

      const addr = t?.pradr?.addr ?? {};
      const address = [addr.bno, addr.bnm, addr.flno, addr.st, addr.loc, addr.city, addr.dst, addr.pncd]
        .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
        .join(", ");

      return {
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
      };
    } catch (e) {
      // Nest's own HttpExceptions (404/502 above) must pass through untouched.
      if (e instanceof HttpException) throw e;
      throw new HttpException(
        { error: "gst_lookup_failed", message: e instanceof Error ? e.message : "unknown" },
        502
      );
    }
  }

  /** GSTR-1 return JSON (B2B + B2C summary). */
  async gstr1(user: AuthUser, monthQ?: string, yearQ?: string) {
    const businessId = await getUserBusinessId(user);
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const now = new Date();
    const month = Number(monthQ ?? now.getMonth() + 1);
    const year = Number(yearQ ?? now.getFullYear());
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const invoices = await this.prisma.transaction.findMany({
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

    return {
      gstin: business.gstin ?? "",
      fp: `${String(month).padStart(2, "0")}${year}`,
      gt: rs(invoices.reduce((s, i) => s + i.grandTotal, 0)),
      b2b: [...b2bMap.values()],
      b2cs,
    };
  }

  /** NIC e-invoice JSON payload for one invoice. */
  async einvoice(user: AuthUser, id: string) {
    const businessId = await getUserBusinessId(user);
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId } });
    const inv = await this.prisma.transaction.findFirst({
      where: { id, businessId, type: "sale", deletedAt: null },
      include: { party: true, lines: { orderBy: { lineNo: "asc" } } },
    });
    if (!inv) throw new NotFoundException({ error: "not_found" });

    return {
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
  }
}

@Controller("gst")
@UseGuards(SupabaseAuthGuard)
export class GstController {
  constructor(private readonly gst: GstService) {}

  @Get("lookup/:gstin")
  lookup(@Param("gstin") gstin: string) {
    return this.gst.lookup(gstin);
  }

  @Get("gstr1")
  gstr1(@CurrentUser() user: AuthUser, @Query("month") month?: string, @Query("year") year?: string) {
    return this.gst.gstr1(user, month, year);
  }

  @Get("einvoice/:id")
  einvoice(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.gst.einvoice(user, id);
  }
}

@Module({ controllers: [GstController], providers: [GstService] })
export class GstModule {}
