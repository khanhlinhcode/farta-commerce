import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuthModule } from "../auth/auth.module";
import { CartModule } from "../cart/cart.module";
import { PaymentsModule } from "../payments/payments.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { Order, OrderSchema } from "./schemas/order.schema";

@Module({
  imports: [
    AuthModule,
    CartModule,
    PaymentsModule,
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, MongooseModule],
})
export class OrdersModule {}
