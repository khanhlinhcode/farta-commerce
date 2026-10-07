import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { PaymentsService } from "./payments.service";
import { Payment, PaymentSchema } from "./schemas/payment.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
  ],
  providers: [PaymentsService],
  exports: [PaymentsService, MongooseModule],
})
export class PaymentsModule {}
