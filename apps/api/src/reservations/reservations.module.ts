import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { ReservationsService } from "./reservations.service";
import { Reservation, ReservationSchema } from "./schemas/reservation.schema";
import { InventoryModule } from "../inventory/inventory.module";

@Module({
  imports: [
    InventoryModule,
    MongooseModule.forFeature([
      { name: Reservation.name, schema: ReservationSchema },
    ]),
  ],
  providers: [ReservationsService],
  exports: [ReservationsService, MongooseModule],
})
export class ReservationsModule {}
