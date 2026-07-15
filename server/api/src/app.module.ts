import { Module } from "@nestjs/common";
import { PrismaModule } from "./common/prisma.module";
import { HealthModule } from "./health/health.controller";
import { StoreModule } from "./store/store.controller";
import { AuthModule } from "./auth/auth.controller";
import { BusinessModule } from "./business/business.controller";
import { BusinessesModule } from "./businesses/businesses.controller";
import { BackupModule } from "./backup/backup.controller";
import { PartiesModule } from "./parties/parties.controller";
import { ItemsModule } from "./items/items.controller";
import { InvoicesModule } from "./invoices/invoices.controller";
import { PaymentsModule } from "./payments/payments.controller";
import { PurchasesModule } from "./purchases/purchases.controller";
import { ExpensesModule } from "./expenses/expenses.controller";
import { DocumentsModule } from "./documents/documents.controller";
import { BankModule } from "./bank/bank.controller";
import { CardsModule } from "./cards/cards.controller";
import { ChequesModule } from "./cheques/cheques.controller";
import { LoansModule } from "./loans/loans.controller";
import { ReportsModule } from "./reports/reports.controller";
import { GstModule } from "./gst/gst.controller";
import { ManufacturingModule } from "./manufacturing/manufacturing.controller";

@Module({
  imports: [
    PrismaModule,

    // Public
    HealthModule,
    StoreModule, // public online catalog
    AuthModule, // register, username login, OTP (own tighter rate limit)

    // Authenticated — each controller applies SupabaseAuthGuard
    BusinessModule,
    BusinessesModule,
    BackupModule,
    PartiesModule,
    ItemsModule,
    InvoicesModule,
    PaymentsModule,
    PurchasesModule,
    ExpensesModule,
    DocumentsModule,
    BankModule,
    CardsModule,
    ChequesModule,
    LoansModule,
    ReportsModule,
    GstModule,
    ManufacturingModule, // /api/bom, /api/production, /api/godowns
  ],
})
export class AppModule {}
