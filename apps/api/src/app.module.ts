import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { CategoriesModule } from "./categories/categories.module";
import { BannersModule } from "./banners/banners.module";
import { CartModule } from "./cart/cart.module";
import { CheckoutModule } from "./checkout/checkout.module";
import { IdempotencyModule } from "./idempotency/idempotency.module";
import { InventoryModule } from "./inventory/inventory.module";
import { MediaModule } from "./media/media.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ProductsModule } from "./products/products.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { ReservationsModule } from "./reservations/reservations.module";
import { VariantsModule } from "./variants/variants.module";
import { validateEnvironment } from "./config/environment";
import { HealthModule } from "./health/health.module";
import { DatabaseModule } from "./infrastructure/database.module";
import { RedisModule } from "./infrastructure/redis.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RedisModule,
    AuthModule,
    AuditModule,
    CategoriesModule,
    MediaModule,
    BannersModule,
    CartModule,
    IdempotencyModule,
    ReservationsModule,
    NotificationsModule,
    PaymentsModule,
    OrdersModule,
    CheckoutModule,
    ProductsModule,
    VariantsModule,
    InventoryModule,
    HealthModule,
  ],
})
export class AppModule {}
