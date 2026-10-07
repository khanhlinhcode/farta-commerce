import { Inject, Injectable } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Connection, Model, Types } from "mongoose";

import { objectId } from "../catalog/catalog.utils";
import { InventoryService } from "../inventory/inventory.service";
import {
  Reservation,
  type ReservationDocument,
} from "./schemas/reservation.schema";

export type ReservationItem = { variantId: string; quantity: number };

@Injectable()
export class ReservationsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Reservation.name)
    private readonly reservations: Model<ReservationDocument>,
    @Inject(InventoryService) private readonly inventory: InventoryService,
  ) {}

  async createActive(
    input: {
      items: ReadonlyArray<ReservationItem>;
      cartId: string;
      customerId: string | null;
      guestOwnerDigest: string | null;
      expiresAt: Date;
      idempotencyRecordId: string;
    },
    session: ClientSession,
  ): Promise<ReservationDocument[]> {
    return this.reservations.create(
      input.items.map((item) => ({
        variantId: objectId(item.variantId),
        quantity: item.quantity,
        cartId: objectId(input.cartId),
        customerId: input.customerId ? objectId(input.customerId) : null,
        guestOwnerDigest: input.guestOwnerDigest,
        status: "ACTIVE",
        expiresAt: input.expiresAt,
        confirmedAt: null,
        releasedAt: null,
        referenceType: null,
        referenceId: null,
        idempotencyRecordId: objectId(input.idempotencyRecordId),
      })),
      { session },
    );
  }

  async confirm(
    reservationIds: ReadonlyArray<Types.ObjectId>,
    orderId: string,
    session: ClientSession,
  ): Promise<void> {
    const now = new Date();
    const result = await this.reservations.updateMany(
      { _id: { $in: reservationIds }, status: "ACTIVE" },
      {
        $set: {
          status: "CONFIRMED",
          confirmedAt: now,
          referenceType: "ORDER",
          referenceId: objectId(orderId),
        },
      },
      { session },
    );
    if (result.modifiedCount !== reservationIds.length) {
      throw new Error("Reservation confirmation was incomplete.");
    }
  }

  async expireDue(limit: number, requestId: string): Promise<number> {
    const due = await this.reservations
      .find({ status: "ACTIVE", expiresAt: { $lte: new Date() } })
      .sort({ expiresAt: 1, _id: 1 })
      .limit(limit)
      .select("+guestOwnerDigest")
      .exec();
    let released = 0;
    for (const candidate of due) {
      const session = await this.connection.startSession();
      try {
        await session.withTransaction(async () => {
          const reservation = await this.reservations
            .findOne({
              _id: candidate._id,
              status: "ACTIVE",
              expiresAt: { $lte: new Date() },
            })
            .session(session);
          if (!reservation) return;
          await this.inventory.releaseBatch(
            [
              {
                variantId: reservation.variantId.toString(),
                quantity: reservation.quantity,
              },
            ],
            {
              requestId,
              actorId: null,
              reason: "Checkout reservation expired.",
              referenceType: "RESERVATION",
              referenceId: reservation.id,
              idempotencyPrefix: `reservation-expire:${reservation.id}`,
            },
            session,
          );
          reservation.status = "EXPIRED";
          reservation.releasedAt = new Date();
          await reservation.save({ session });
          released += 1;
        });
      } finally {
        await session.endSession();
      }
    }
    return released;
  }

  async release(
    reservationIds: ReadonlyArray<string>,
    input: {
      requestId: string;
      actorId: string | null;
      reason: string;
    },
  ): Promise<number> {
    let released = 0;
    for (const reservationId of reservationIds) {
      const session = await this.connection.startSession();
      try {
        await session.withTransaction(async () => {
          const reservation = await this.reservations
            .findOne({
              _id: objectId(reservationId),
              status: { $in: ["ACTIVE", "CONFIRMED"] },
            })
            .session(session);
          if (!reservation) return;
          await this.inventory.releaseBatch(
            [
              {
                variantId: reservation.variantId.toString(),
                quantity: reservation.quantity,
              },
            ],
            {
              requestId: input.requestId,
              actorId: input.actorId,
              reason: input.reason,
              referenceType: "RESERVATION",
              referenceId: reservation.id,
              idempotencyPrefix: `reservation-release:${reservation.id}`,
            },
            session,
          );
          const result = await this.reservations.updateOne(
            {
              _id: reservation._id,
              status: reservation.status,
            },
            { $set: { status: "RELEASED", releasedAt: new Date() } },
            { session },
          );
          if (result.modifiedCount !== 1) {
            throw new Error("Reservation release state changed concurrently.");
          }
          released += 1;
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: unknown }).code === 11_000
        ) {
          continue;
        }
        throw error;
      } finally {
        await session.endSession();
      }
    }
    return released;
  }
}
