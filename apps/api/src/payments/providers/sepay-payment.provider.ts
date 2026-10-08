import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { ApiException } from "../../common/api-exception";
import type { Environment } from "../../config/environment";
import type { SePayWebhookDto } from "../dto/payment.dto";
import type { PaymentDocument } from "../schemas/payment.schema";
import {
  PaymentProvider,
  type NormalizedPaymentEvent,
  type PaymentInstructions,
} from "./payment-provider";

@Injectable()
export class SePayPaymentProvider extends PaymentProvider {
  private readonly enabled: boolean;
  private readonly bankName: string;
  private readonly accountNumber: string;
  private readonly accountHolder: string;
  private readonly webhookSecret: string;
  private readonly toleranceSeconds: number;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    super();
    this.enabled = config.get("SEPAY_ENABLED", { infer: true });
    this.bankName = config.get("SEPAY_BANK_NAME", { infer: true });
    this.accountNumber = config.get("SEPAY_ACCOUNT_NUMBER", { infer: true });
    this.accountHolder = config.get("SEPAY_ACCOUNT_HOLDER", { infer: true });
    this.webhookSecret = config.get("SEPAY_WEBHOOK_SECRET", { infer: true });
    this.toleranceSeconds = config.get("SEPAY_WEBHOOK_TOLERANCE_SECONDS", {
      infer: true,
    });
  }

  initiate(payment: PaymentDocument, amountDue: number): PaymentInstructions {
    if (
      !this.enabled ||
      payment.provider !== "SEPAY" ||
      !payment.providerReference ||
      !payment.expiresAt ||
      payment.method === "COD"
    ) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        "PAYMENT_PROVIDER_UNAVAILABLE",
        "Online payment is not available for this order.",
      );
    }
    const qr = new URL("https://vietqr.app/img");
    qr.searchParams.set("acc", this.accountNumber);
    qr.searchParams.set("bank", this.bankName);
    qr.searchParams.set("amount", String(amountDue));
    qr.searchParams.set("des", payment.providerReference);
    qr.searchParams.set("template", "compact");
    qr.searchParams.set("showinfo", "true");
    qr.searchParams.set("holder", this.accountHolder);
    return {
      provider: "SEPAY",
      method: payment.method,
      amount: amountDue,
      currency: "VND",
      reference: payment.providerReference,
      expiresAt: payment.expiresAt.toISOString(),
      bank: {
        name: this.bankName,
        accountNumber: this.accountNumber,
        accountHolder: this.accountHolder,
      },
      qrUrl: qr.toString(),
    };
  }

  verifyWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    timestamp: string | undefined,
    payload: SePayWebhookDto,
  ): NormalizedPaymentEvent {
    if (!this.enabled || !this.webhookSecret) this.unauthorized();
    if (!rawBody || rawBody.length === 0 || rawBody.length > 1_048_576) {
      this.unauthorized();
    }
    if (!timestamp || !/^[0-9]{10,12}$/.test(timestamp)) this.unauthorized();
    const timestampSeconds = Number(timestamp);
    if (
      !Number.isSafeInteger(timestampSeconds) ||
      Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) >
        this.toleranceSeconds
    ) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "SEPAY_WEBHOOK_EXPIRED",
        "Webhook authentication failed.",
      );
    }
    if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) {
      this.unauthorized();
    }
    const expected = `sha256=${createHmac("sha256", this.webhookSecret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest("hex")}`;
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      this.unauthorized();
    }
    return {
      provider: "SEPAY",
      eventId: String(payload.id),
      reference: payload.code?.trim().toUpperCase() || null,
      transferType: payload.transferType,
      amount: payload.transferAmount,
      currency: "VND",
      accountNumber: payload.accountNumber.trim(),
      referenceCode: payload.referenceCode,
      occurredAt: payload.transactionDate,
      payloadHash: createHash("sha256").update(rawBody).digest("hex"),
      safeSummary: {
        gateway: payload.gateway,
        accountSuffix: payload.accountNumber.slice(-4),
        transferType: payload.transferType,
        amount: payload.transferAmount,
        referenceCode: payload.referenceCode,
        occurredAt: payload.transactionDate,
      },
    };
  }

  expectedAccountNumber(): string {
    return this.accountNumber;
  }

  private unauthorized(): never {
    throw new ApiException(
      HttpStatus.UNAUTHORIZED,
      "SEPAY_WEBHOOK_UNAUTHORIZED",
      "Webhook authentication failed.",
    );
  }
}
