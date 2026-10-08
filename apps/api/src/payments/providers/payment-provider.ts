import type { PaymentDocument } from "../schemas/payment.schema";
import type { SePayWebhookDto } from "../dto/payment.dto";

export type PaymentInstructions = {
  provider: "SEPAY";
  method: "DEPOSIT" | "FULL";
  amount: number;
  currency: "VND";
  reference: string;
  expiresAt: string;
  bank: {
    name: string;
    accountNumber: string;
    accountHolder: string;
  };
  qrUrl: string;
};

export type NormalizedPaymentEvent = {
  provider: "SEPAY";
  eventId: string;
  reference: string | null;
  transferType: "in" | "out";
  amount: number;
  currency: "VND";
  accountNumber: string;
  referenceCode: string;
  occurredAt: string;
  payloadHash: string;
  safeSummary: Record<string, unknown>;
};

export abstract class PaymentProvider {
  abstract initiate(
    payment: PaymentDocument,
    amountDue: number,
  ): PaymentInstructions;

  abstract verifyWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    timestamp: string | undefined,
    payload: SePayWebhookDto,
  ): NormalizedPaymentEvent;
}
