import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Connection, Model } from "mongoose";
import mongoose from "mongoose";

import { AuditService } from "../audit/audit.service";
import { ApiException } from "../common/api-exception";
import { objectId } from "../catalog/catalog.utils";
import {
  ProductVariant,
  type ProductVariantDocument,
} from "../variants/schemas/product-variant.schema";
import {
  InventoryTransaction,
  type InventoryTransactionDocument,
} from "./schemas/inventory-transaction.schema";
import { Inventory, type InventoryDocument } from "./schemas/inventory.schema";

type MutationActor = { userId: string; requestId: string };
export type InventoryBatchItem = { variantId: string; quantity: number };
export type InventoryBatchContext = {
  requestId: string;
  actorId: string | null;
  reason: string;
  referenceType: string;
  referenceId: string;
  idempotencyPrefix: string;
};
export type InventoryResponse = {
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
};

@Injectable()
export class InventoryService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Inventory.name)
    private readonly inventories: Model<InventoryDocument>,
    @InjectModel(InventoryTransaction.name)
    private readonly transactions: Model<InventoryTransactionDocument>,
    @InjectModel(ProductVariant.name)
    private readonly variants: Model<ProductVariantDocument>,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async get(variantId: string): Promise<InventoryResponse> {
    const id = objectId(variantId);
    const [inventory, variant] = await Promise.all([
      this.inventories.findOne({ variantId: id }).exec(),
      this.variants.findById(id).select({ lowStockThreshold: 1 }).exec(),
    ]);
    if (!inventory || !variant) this.notFound();
    return this.response(inventory, variant.lowStockThreshold);
  }

  async adjust(
    variantId: string,
    quantityDelta: number,
    reason: string,
    idempotencyKey: string,
    actor: MutationActor,
  ): Promise<InventoryResponse> {
    if (quantityDelta === 0) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "INVALID_INVENTORY_ADJUSTMENT",
        "Inventory adjustment must not be zero.",
      );
    }
    const previous = await this.transactions.findOne({
      type: "ADJUSTMENT",
      idempotencyKey,
    });
    if (previous) return this.get(variantId);

    const id = objectId(variantId);
    const session = await this.connection.startSession();
    try {
      let result: InventoryResponse | undefined;
      await session.withTransaction(async () => {
        const variant = await this.variants
          .findOne({ _id: id, status: { $ne: "ARCHIVED" } })
          .session(session);
        if (!variant) this.notFound();
        const filter =
          quantityDelta < 0
            ? mongoose.trusted({
                variantId: id,
                $expr: {
                  $gte: [{ $add: ["$onHand", quantityDelta] }, "$reserved"],
                },
              })
            : { variantId: id };
        const inventory = await this.inventories.findOneAndUpdate(
          filter,
          { $inc: { onHand: quantityDelta } },
          { returnDocument: "after", session },
        );
        if (!inventory) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            "INSUFFICIENT_STOCK",
            "Inventory cannot be reduced below reserved stock.",
          );
        }
        await this.transactions.create(
          [
            {
              variantId: id,
              type: "ADJUSTMENT",
              quantityDelta,
              reason: reason.trim(),
              referenceType: null,
              referenceId: null,
              actorId: objectId(actor.userId),
              requestId: actor.requestId,
              idempotencyKey,
              onHandAfter: inventory.onHand,
              reservedAfter: inventory.reserved,
            },
          ],
          { session },
        );
        await this.audit.record(
          {
            action: "inventory.adjust",
            resourceType: "Inventory",
            resourceId: inventory.id,
            actorId: actor.userId,
            requestId: actor.requestId,
            after: {
              variantId,
              quantityDelta,
              onHand: inventory.onHand,
              reserved: inventory.reserved,
            },
            reason: reason.trim(),
          },
          session,
        );
        result = this.response(inventory, variant.lowStockThreshold);
      });
      if (!result) throw new Error("Inventory transaction did not commit.");
      return result;
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === 11_000
      ) {
        return this.get(variantId);
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async reserve(
    variantId: string,
    quantity: number,
    reason: string,
    idempotencyKey: string,
    actor: MutationActor,
  ): Promise<InventoryResponse> {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        "INVALID_RESERVATION",
        "Reservation quantity is invalid.",
      );
    }
    const previous = await this.transactions.findOne({
      type: "RESERVE",
      idempotencyKey,
    });
    if (previous) return this.get(variantId);
    const id = objectId(variantId);
    const session = await this.connection.startSession();
    try {
      let result: InventoryResponse | undefined;
      await session.withTransaction(async () => {
        const variant = await this.variants
          .findOne({ _id: id, status: "ACTIVE" })
          .session(session);
        if (!variant) this.notFound();
        const inventory = await this.inventories.findOneAndUpdate(
          mongoose.trusted({
            variantId: id,
            $expr: {
              $gte: [{ $subtract: ["$onHand", "$reserved"] }, quantity],
            },
          }),
          { $inc: { reserved: quantity } },
          { returnDocument: "after", session },
        );
        if (!inventory) {
          throw new ApiException(
            HttpStatus.CONFLICT,
            "INSUFFICIENT_STOCK",
            "Insufficient stock.",
          );
        }
        await this.transactions.create(
          [
            {
              variantId: id,
              type: "RESERVE",
              quantityDelta: -quantity,
              reason,
              referenceType: null,
              referenceId: null,
              actorId: objectId(actor.userId),
              requestId: actor.requestId,
              idempotencyKey,
              onHandAfter: inventory.onHand,
              reservedAfter: inventory.reserved,
            },
          ],
          { session },
        );
        result = this.response(inventory, variant.lowStockThreshold);
      });
      if (!result) throw new Error("Reservation transaction did not commit.");
      return result;
    } finally {
      await session.endSession();
    }
  }

  async reserveBatch(
    items: ReadonlyArray<InventoryBatchItem>,
    context: InventoryBatchContext,
    session: ClientSession,
  ): Promise<void> {
    for (const item of items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "INVALID_RESERVATION",
          "Reservation quantity is invalid.",
        );
      }
      const variantId = objectId(item.variantId);
      const inventory = await this.inventories.findOneAndUpdate(
        mongoose.trusted({
          variantId,
          $expr: {
            $gte: [{ $subtract: ["$onHand", "$reserved"] }, item.quantity],
          },
        }),
        { $inc: { reserved: item.quantity } },
        { returnDocument: "after", session },
      );
      if (!inventory) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          "INSUFFICIENT_STOCK",
          "One or more checkout items are no longer available.",
        );
      }
      await this.transactions.create(
        [
          {
            variantId,
            type: "RESERVE",
            quantityDelta: -item.quantity,
            reason: context.reason,
            referenceType: context.referenceType,
            referenceId: context.referenceId,
            actorId: context.actorId ? objectId(context.actorId) : null,
            requestId: context.requestId,
            idempotencyKey: `${context.idempotencyPrefix}:${item.variantId}`,
            onHandAfter: inventory.onHand,
            reservedAfter: inventory.reserved,
          },
        ],
        { session },
      );
    }
  }

  async releaseBatch(
    items: ReadonlyArray<InventoryBatchItem>,
    context: InventoryBatchContext,
    session: ClientSession,
  ): Promise<void> {
    for (const item of items) {
      const variantId = objectId(item.variantId);
      const inventory = await this.inventories.findOneAndUpdate(
        mongoose.trusted({ variantId, reserved: { $gte: item.quantity } }),
        { $inc: { reserved: -item.quantity } },
        { returnDocument: "after", session },
      );
      if (!inventory) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          "RESERVATION_RELEASE_CONFLICT",
          "Reserved inventory could not be released safely.",
        );
      }
      await this.transactions.create(
        [
          {
            variantId,
            type: "RELEASE",
            quantityDelta: item.quantity,
            reason: context.reason,
            referenceType: context.referenceType,
            referenceId: context.referenceId,
            actorId: context.actorId ? objectId(context.actorId) : null,
            requestId: context.requestId,
            idempotencyKey: `${context.idempotencyPrefix}:${item.variantId}`,
            onHandAfter: inventory.onHand,
            reservedAfter: inventory.reserved,
          },
        ],
        { session },
      );
    }
  }

  private response(
    inventory: InventoryDocument,
    lowStockThreshold: number,
  ): InventoryResponse {
    return {
      variantId: inventory.variantId.toString(),
      onHand: inventory.onHand,
      reserved: inventory.reserved,
      available: inventory.onHand - inventory.reserved,
      lowStockThreshold,
    };
  }

  private notFound(): never {
    throw new ApiException(
      HttpStatus.NOT_FOUND,
      "INVENTORY_NOT_FOUND",
      "Inventory was not found.",
    );
  }
}
