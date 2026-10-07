import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CartModule } from "../cart/cart.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { InventoryModule } from "../inventory/inventory.module";
import { OrdersModule } from "../orders/orders.module";
import { PaymentsModule } from "../payments/payments.module";
import { ReservationsModule } from "../reservations/reservations.module";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";

@Module({
  imports: [
    AuthModule,
    CartModule,
    IdempotencyModule,
    InventoryModule,
    ReservationsModule,
    OrdersModule,
    PaymentsModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
