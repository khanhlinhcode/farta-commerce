import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { createHash } from "node:crypto";
import type { ClientSession, Model } from "mongoose";

import { objectId } from "../catalog/catalog.utils";
import { Payment, type PaymentDocument } from "./schemas/payment.schema";

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly payments: Model<PaymentDocument>,
  ) {}

  async createCod(
    orderId: string,
    amount: number,
    idempotencyKey: string,
    session: ClientSession,
  ): Promise<PaymentDocument> {
    const [payment] = await this.payments.create(
      [
        {
          orderId: objectId(orderId),
          provider: "COD",
          method: "COD",
          expectedAmount: amount,
          currency: "VND",
          status: "UNPAID",
          idempotencyKeyHash: createHash("sha256")
            .update(idempotencyKey)
            .digest("hex"),
          providerTransactionId: null,
          providerReference: null,
          providerPayloadSafeSummary: null,
          codAmount: amount,
          codCollectedAt: null,
          codCollectedBy: null,
        },
      ],
      { session },
    );
    if (!payment) throw new Error("Payment was not created.");
    return payment;
  }
}
