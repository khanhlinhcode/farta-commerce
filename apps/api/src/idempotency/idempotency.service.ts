import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { createHash } from "node:crypto";
import type { ClientSession, Model } from "mongoose";

import { ApiException } from "../common/api-exception";
import {
  IdempotencyRecord,
  type IdempotencyRecordDocument,
} from "./schemas/idempotency-record.schema";

export type IdempotencyIdentity = {
  realm: "CUSTOMER" | "GUEST";
  ownerKey: string;
  operation: string;
  key: string;
  requestHash: string;
};

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectModel(IdempotencyRecord.name)
    private readonly records: Model<IdempotencyRecordDocument>,
  ) {}

  hashRequest(input: unknown): string {
    return createHash("sha256").update(this.canonical(input)).digest("hex");
  }

  async claim(
    identity: IdempotencyIdentity,
    session: ClientSession,
  ): Promise<IdempotencyRecordDocument> {
    const [record] = await this.records.create(
      [
        {
          realm: identity.realm,
          ownerKey: identity.ownerKey,
          operation: identity.operation,
          keyHash: this.keyHash(identity.key),
          requestHash: identity.requestHash,
          status: "IN_PROGRESS",
          resourceType: null,
          resourceId: null,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      ],
      { session },
    );
    if (!record) throw new Error("Idempotency claim was not created.");
    return record;
  }

  async complete(
    recordId: string,
    resourceType: string,
    resourceId: string,
    session: ClientSession,
  ): Promise<void> {
    const result = await this.records.updateOne(
      { _id: recordId, status: "IN_PROGRESS" },
      { $set: { status: "COMPLETED", resourceType, resourceId } },
      { session },
    );
    if (result.modifiedCount !== 1) {
      throw new Error("Idempotency record could not be completed.");
    }
  }

  async find(identity: IdempotencyIdentity) {
    const record = await this.records
      .findOne({
        realm: identity.realm,
        ownerKey: identity.ownerKey,
        operation: identity.operation,
        keyHash: this.keyHash(identity.key),
      })
      .select("+ownerKey +keyHash +requestHash")
      .exec();
    if (!record) return null;
    if (record.requestHash !== identity.requestHash) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "IDEMPOTENCY_KEY_REUSED",
        "The idempotency key was already used for a different request.",
      );
    }
    return record;
  }

  private keyHash(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }

  private canonical(value: unknown): string {
    if (value === null || typeof value !== "object")
      return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.canonical(item)).join(",")}]`;
    }
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.canonical(object[key])}`)
      .join(",")}}`;
  }
}
