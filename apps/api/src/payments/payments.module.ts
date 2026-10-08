import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuthModule } from "../auth/auth.module";
import { CartModule } from "../cart/cart.module";
import { Order, OrderSchema } from "../orders/schemas/order.schema";
import { ReservationsModule } from "../reservations/reservations.module";
import {
  Reservation,
  ReservationSchema,
} from "../reservations/schemas/reservation.schema";
import {
  PaymentsController,
  SePayWebhookController,
} from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PaymentProvider } from "./providers/payment-provider";
import { SePayPaymentProvider } from "./providers/sepay-payment.provider";
import {
  PaymentWebhookEvent,
  PaymentWebhookEventSchema,
} from "./schemas/payment-webhook-event.schema";
import { Payment, PaymentSchema } from "./schemas/payment.schema";

@Module({
  imports: [
    AuthModule,
    CartModule,
    ReservationsModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: PaymentWebhookEvent.name, schema: PaymentWebhookEventSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Reservation.name, schema: ReservationSchema },
    ]),
  ],
  controllers: [PaymentsController, SePayWebhookController],
  providers: [
    PaymentsService,
    SePayPaymentProvider,
    { provide: PaymentProvider, useExisting: SePayPaymentProvider },
  ],
  exports: [PaymentsService, MongooseModule],
})
export class PaymentsModule {}
