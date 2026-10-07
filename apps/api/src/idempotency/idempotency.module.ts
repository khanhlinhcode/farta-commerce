import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { IdempotencyService } from "./idempotency.service";
import {
  IdempotencyRecord,
  IdempotencyRecordSchema,
} from "./schemas/idempotency-record.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IdempotencyRecord.name, schema: IdempotencyRecordSchema },
    ]),
  ],
  providers: [IdempotencyService],
  exports: [IdempotencyService, MongooseModule],
})
export class IdempotencyModule {}
