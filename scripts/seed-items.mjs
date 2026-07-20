/**
 * seed-items.mjs
 * ----------------
 * 1. Undoes / clears existing item stock, BOMs, and items for the business.
 * 2. Seeds 5 Finished Goods under "Finished Goods" category.
 * 3. Seeds 12 Raw Materials under "Raw Materials" category.
 * 4. Links BOM recipes connecting Finished Goods to Raw Materials.
 *
 * Usage (from project root):
 *   node scripts/seed-items.mjs
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from project root
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env");
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?([^"#]*)"?\s*$/);
  if (m) process.env[m[1]] = m[2].trim();
}

// Use direct URL for raw execution
process.env.DATABASE_URL = process.env.DIRECT_URL;

const prisma = new PrismaClient({ log: [] });

const rs = (rupees) => Math.round(rupees * 100); // rupees -> paise

async function getBusinessId() {
  const biz = await prisma.business.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!biz) throw new Error("No business found. Create a business first.");
  console.log(`Business: "${biz.name}" (${biz.id})`);
  return biz.id;
}

async function main() {
  const businessId = await getBusinessId();

  console.log("\n🗑️  Undoing & clearing previous items, BOMs, and stock records...");

  // Delete dependencies in order
  const delMovements = await prisma.stockMovement.deleteMany({ where: { businessId } });
  const delBomLines = await prisma.bomLine.deleteMany({ where: { bom: { businessId } } });
  const delBoms = await prisma.bom.deleteMany({ where: { businessId } });
  const delBatches = await prisma.itemBatch.deleteMany({ where: { businessId } });
  const delSerials = await prisma.serialNumber.deleteMany({ where: { businessId } });
  const delItems = await prisma.item.deleteMany({ where: { businessId } });

  console.log(
    `  Removed: ${delItems.count} items, ${delBoms.count} BOMs, ${delBomLines.count} BOM lines, ${delMovements.count} stock movements.`
  );

  console.log("\n📁 Creating Product & Raw Material Categories...");

  let finishedCat = await prisma.itemCategory.findFirst({
    where: { businessId, name: "Finished Goods", deletedAt: null },
  });
  if (!finishedCat) {
    finishedCat = await prisma.itemCategory.create({
      data: { id: randomUUID(), businessId, name: "Finished Goods" },
    });
  }

  let rawCat = await prisma.itemCategory.findFirst({
    where: { businessId, name: "Raw Materials", deletedAt: null },
  });
  if (!rawCat) {
    rawCat = await prisma.itemCategory.create({
      data: { id: randomUUID(), businessId, name: "Raw Materials" },
    });
  }

  // 1. Finished Goods (5 Products)
  console.log("\n🛍️  Seeding 5 Finished Goods (Product List)...");

  const finishedGoods = [
    {
      code: "FG-JCAN-5L",
      name: "5 ltr jerrycan",
      unit: "PCS",
      salePriceRs: 40,
      purchasePriceRs: 24,
      taxRate: 18,
      hsnSac: "3923",
      openingStock: 184420,
    },
    {
      code: "FG-JCAN-10L",
      name: "10 Ltr Heavy-Duty Jerrycan",
      unit: "PCS",
      salePriceRs: 75,
      purchasePriceRs: 45,
      taxRate: 18,
      hsnSac: "3923",
      openingStock: 45000,
    },
    {
      code: "FG-DRUM-20L",
      name: "20 Ltr Industrial Chemical Drum",
      unit: "PCS",
      salePriceRs: 160,
      purchasePriceRs: 98,
      taxRate: 18,
      hsnSac: "3923",
      openingStock: 12500,
    },
    {
      code: "FG-BTL-1L",
      name: "1 Ltr HDPE Narrow Neck Bottle",
      unit: "PCS",
      salePriceRs: 18,
      purchasePriceRs: 10.5,
      taxRate: 18,
      hsnSac: "3923",
      openingStock: 95000,
    },
    {
      code: "FG-BTL-250M",
      name: "250 ml PET Spray Bottle with Nozzle",
      unit: "PCS",
      salePriceRs: 12.5,
      purchasePriceRs: 7.2,
      taxRate: 18,
      hsnSac: "3923",
      openingStock: 140000,
    },
  ];

  const itemRecordsMap = {};

  for (const fg of finishedGoods) {
    const item = await prisma.item.create({
      data: {
        id: randomUUID(),
        businessId,
        itemCode: fg.code,
        name: fg.name,
        type: "product",
        categoryId: finishedCat.id,
        unit: fg.unit,
        salePrice: rs(fg.salePriceRs),
        purchasePrice: rs(fg.purchasePriceRs),
        taxRate: fg.taxRate,
        hsnSac: fg.hsnSac,
        openingStock: fg.openingStock,
      },
    });
    itemRecordsMap[fg.code] = item.id;
    console.log(`  ✅ Product: "${fg.name}" (${fg.code}) — Stock: ${fg.openingStock} ${fg.unit}`);
  }

  // 2. Raw Materials (12 Items)
  console.log("\n🧪 Seeding 12 Raw Materials (Raw Items)...");

  const rawMaterials = [
    {
      code: "RM-HDPE-5502",
      name: "HDPE Blow Moulding Polymer Granules (Grade 5502)",
      unit: "KGS",
      salePriceRs: 110,
      purchasePriceRs: 92,
      taxRate: 18,
      hsnSac: "3901",
      openingStock: 25000,
    },
    {
      code: "RM-PP-INJ",
      name: "Polypropylene (PP) Injection Grade Granules",
      unit: "KGS",
      salePriceRs: 105,
      purchasePriceRs: 88,
      taxRate: 18,
      hsnSac: "3902",
      openingStock: 12000,
    },
    {
      code: "RM-MB-WHT",
      name: "White Masterbatch Color Pigment Concentrate",
      unit: "KGS",
      salePriceRs: 165,
      purchasePriceRs: 140,
      taxRate: 18,
      hsnSac: "3206",
      openingStock: 1500,
    },
    {
      code: "RM-MB-BLU",
      name: "Blue Masterbatch Color Pigment Concentrate",
      unit: "KGS",
      salePriceRs: 180,
      purchasePriceRs: 155,
      taxRate: 18,
      hsnSac: "3206",
      openingStock: 800,
    },
    {
      code: "RM-CAP-38MM",
      name: "Threaded Screw Caps (38mm Anti-Tamper)",
      unit: "PCS",
      salePriceRs: 3.5,
      purchasePriceRs: 2.2,
      taxRate: 18,
      hsnSac: "3923",
      openingStock: 350000,
    },
    {
      code: "RM-CAP-50MM",
      name: "Threaded Screw Caps (50mm Heavy Duty)",
      unit: "PCS",
      salePriceRs: 6.5,
      purchasePriceRs: 4.5,
      taxRate: 18,
      hsnSac: "3923",
      openingStock: 180000,
    },
    {
      code: "RM-FOIL-38",
      name: "Induction Foil Seal Liners (38mm)",
      unit: "PCS",
      salePriceRs: 1.5,
      purchasePriceRs: 0.85,
      taxRate: 18,
      hsnSac: "3920",
      openingStock: 500000,
    },
    {
      code: "RM-GSK-50",
      name: "Silicon Gaskets & O-Rings (50mm)",
      unit: "PCS",
      salePriceRs: 2.8,
      purchasePriceRs: 1.6,
      taxRate: 18,
      hsnSac: "4016",
      openingStock: 200000,
    },
    {
      code: "RM-PUMP-24",
      name: "Fine Mist Trigger Spray Pumps (24/410)",
      unit: "PCS",
      salePriceRs: 6.0,
      purchasePriceRs: 3.8,
      taxRate: 18,
      hsnSac: "8424",
      openingStock: 90000,
    },
    {
      code: "RM-BOX-5P",
      name: "5-Ply Corrugated Outer Shipping Boxes",
      unit: "PCS",
      salePriceRs: 38,
      purchasePriceRs: 28,
      taxRate: 12,
      hsnSac: "4819",
      openingStock: 15000,
    },
    {
      code: "RM-FILM-20M",
      name: "PE Stretch Wrapping Film Rolls (20 Micron)",
      unit: "RLS",
      salePriceRs: 520,
      purchasePriceRs: 450,
      taxRate: 18,
      hsnSac: "3920",
      openingStock: 600,
    },
    {
      code: "RM-UV-ADD",
      name: "UV Weathering Stabilizer Additive",
      unit: "KGS",
      salePriceRs: 390,
      purchasePriceRs: 320,
      taxRate: 18,
      hsnSac: "3812",
      openingStock: 400,
    },
  ];

  for (const rm of rawMaterials) {
    const item = await prisma.item.create({
      data: {
        id: randomUUID(),
        businessId,
        itemCode: rm.code,
        name: rm.name,
        type: "product",
        categoryId: rawCat.id,
        unit: rm.unit,
        salePrice: rs(rm.salePriceRs),
        purchasePrice: rs(rm.purchasePriceRs),
        taxRate: rm.taxRate,
        hsnSac: rm.hsnSac,
        openingStock: rm.openingStock,
      },
    });
    itemRecordsMap[rm.code] = item.id;
    console.log(`  🧪 Raw Item: "${rm.name}" (${rm.code}) — Stock: ${rm.openingStock} ${rm.unit}`);
  }

  // 3. Link BOM Recipes
  console.log("\n⚙️  Linking Bill of Materials (BOM) Recipes...");

  const bomRecipes = [
    {
      finishedCode: "FG-JCAN-5L",
      raws: [
        { code: "RM-HDPE-5502", qty: 0.22 },
        { code: "RM-MB-WHT", qty: 0.008 },
        { code: "RM-CAP-38MM", qty: 1.0 },
        { code: "RM-FOIL-38", qty: 1.0 },
      ],
    },
    {
      finishedCode: "FG-JCAN-10L",
      raws: [
        { code: "RM-HDPE-5502", qty: 0.45 },
        { code: "RM-MB-WHT", qty: 0.015 },
        { code: "RM-CAP-50MM", qty: 1.0 },
        { code: "RM-GSK-50", qty: 1.0 },
      ],
    },
    {
      finishedCode: "FG-DRUM-20L",
      raws: [
        { code: "RM-HDPE-5502", qty: 0.95 },
        { code: "RM-MB-BLU", qty: 0.03 },
        { code: "RM-UV-ADD", qty: 0.01 },
        { code: "RM-CAP-50MM", qty: 1.0 },
        { code: "RM-GSK-50", qty: 1.0 },
      ],
    },
    {
      finishedCode: "FG-BTL-1L",
      raws: [
        { code: "RM-HDPE-5502", qty: 0.055 },
        { code: "RM-MB-WHT", qty: 0.002 },
        { code: "RM-CAP-38MM", qty: 1.0 },
      ],
    },
    {
      finishedCode: "FG-BTL-250M",
      raws: [
        { code: "RM-PP-INJ", qty: 0.025 },
        { code: "RM-PUMP-24", qty: 1.0 },
      ],
    },
  ];

  for (const recipe of bomRecipes) {
    const finishedId = itemRecordsMap[recipe.finishedCode];
    if (!finishedId) continue;

    const bom = await prisma.bom.create({
      data: {
        id: randomUUID(),
        businessId,
        itemId: finishedId,
        lines: {
          create: recipe.raws.map((r) => ({
            id: randomUUID(),
            rawItemId: itemRecordsMap[r.code],
            qty: r.qty,
          })),
        },
      },
      include: { lines: true },
    });

    console.log(
      `  ✨ Linked BOM for ${recipe.finishedCode} with ${bom.lines.length} raw components.`
    );
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Reset & Seeding Complete!
   Product List section:  5 Finished Products
   Raw Items section:     12 Raw Materials
   BOM Manufacturing:     5 Synced Recipes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Seed failed:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
