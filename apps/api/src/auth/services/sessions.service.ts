import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "node:crypto";
import { trusted, Types, type Model } from "mongoose";

import type { Environment } from "../../config/environment";
import type { AuthRealm } from "../auth.constants";
import { Session, type SessionDocument } from "../schemas/session.schema";
import { TokenService } from "./token.service";

export type SessionView = {
  id: string;
  realm: AuthRealm;
  deviceLabel: string | null;
  lastActivityAt: Date;
  createdAt: Date;
  current: boolean;
};

@Injectable()
export class SessionsService {
  private readonly idleTtl: number;
  private readonly absoluteTtl: number;

  constructor(
    @InjectModel(Session.name) private readonly sessions: Model<Session>,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(ConfigService) config: ConfigService<Environment, true>,
  ) {
    this.idleTtl = config.get("SESSION_IDLE_TTL_SECONDS", { infer: true });
    this.absoluteTtl = config.get("SESSION_ABSOLUTE_TTL_SECONDS", {
      infer: true,
    });
  }

  async create(input: {
    userId: string;
    realm: AuthRealm;
    rolesVersion: number;
    deviceLabel: string | null;
  }): Promise<{ session: SessionDocument; refreshToken: string }> {
    const now = new Date();
    const session = new this.sessions({
      _id: new Types.ObjectId(),
      userId: new Types.ObjectId(input.userId),
      realm: input.realm,
      familyId: randomUUID(),
      refreshDigest: "pending",
      rotationCounter: 0,
      rolesVersion: input.rolesVersion,
      lastActivityAt: now,
      idleExpiresAt: new Date(now.getTime() + this.idleTtl * 1000),
      absoluteExpiresAt: new Date(now.getTime() + this.absoluteTtl * 1000),
      revokedAt: null,
      revocationReason: null,
      deviceLabel: input.deviceLabel,
    });
    const refresh = this.tokens.createRefreshCredential(session.id);
    session.refreshDigest = refresh.digest;
    await session.save();
    return { session, refreshToken: refresh.raw };
  }

  async rotate(
    rawCredential: string,
    realm: AuthRealm,
  ): Promise<{ session: SessionDocument; refreshToken: string }> {
    const parsed = this.tokens.parseRefreshCredential(rawCredential);
    const now = new Date();
    const existing = await this.sessions
      .findOne({ _id: parsed.sessionId, realm })
      .select("+refreshDigest")
      .exec();
    if (!existing || !this.isActive(existing, now)) this.invalid();
    if (!this.tokens.digestsEqual(existing.refreshDigest, parsed.digest)) {
      await this.sessions.updateOne(
        { _id: existing._id, revokedAt: null },
        { $set: { revokedAt: now, revocationReason: "REFRESH_REUSE" } },
      );
      throw new UnauthorizedException("Refresh credential reuse detected.");
    }
    const next = this.tokens.createRefreshCredential(existing.id);
    const idleExpiresAt = new Date(now.getTime() + this.idleTtl * 1000);
    const rotated = await this.sessions
      .findOneAndUpdate(
        {
          _id: existing._id,
          realm,
          refreshDigest: parsed.digest,
          revokedAt: null,
          idleExpiresAt: trusted({ $gt: now }),
          absoluteExpiresAt: trusted({ $gt: now }),
        },
        {
          $set: {
            refreshDigest: next.digest,
            lastActivityAt: now,
            idleExpiresAt:
              idleExpiresAt < existing.absoluteExpiresAt
                ? idleExpiresAt
                : existing.absoluteExpiresAt,
          },
          $inc: { rotationCounter: 1 },
        },
        { returnDocument: "after" },
      )
      .select("+refreshDigest")
      .exec();
    if (!rotated) {
      await this.sessions.updateOne(
        { _id: existing._id, revokedAt: null },
        { $set: { revokedAt: now, revocationReason: "REFRESH_RACE" } },
      );
      throw new UnauthorizedException("Refresh credential reuse detected.");
    }
    return { session: rotated, refreshToken: next.raw };
  }

  async requireActive(input: {
    sessionId: string;
    userId: string;
    realm: AuthRealm;
    rolesVersion: number;
  }): Promise<void> {
    const now = new Date();
    const active = await this.sessions.exists({
      _id: new Types.ObjectId(input.sessionId),
      userId: new Types.ObjectId(input.userId),
      realm: input.realm,
      rolesVersion: input.rolesVersion,
      revokedAt: null,
      idleExpiresAt: trusted({ $gt: now }),
      absoluteExpiresAt: trusted({ $gt: now }),
    });
    if (!active) this.invalid();
  }

  async revoke(
    sessionId: string,
    userId: string,
    reason: string,
  ): Promise<boolean> {
    const result = await this.sessions.updateOne(
      {
        _id: new Types.ObjectId(sessionId),
        userId: new Types.ObjectId(userId),
        revokedAt: null,
      },
      { $set: { revokedAt: new Date(), revocationReason: reason } },
    );
    return result.matchedCount === 1;
  }

  async revokeAll(
    userId: string,
    realm: AuthRealm,
    reason: string,
  ): Promise<number> {
    const result = await this.sessions.updateMany(
      { userId: new Types.ObjectId(userId), realm, revokedAt: null },
      { $set: { revokedAt: new Date(), revocationReason: reason } },
    );
    return result.modifiedCount;
  }

  async list(
    userId: string,
    realm: AuthRealm,
    currentId: string,
  ): Promise<SessionView[]> {
    const rows = await this.sessions
      .find({
        userId: new Types.ObjectId(userId),
        realm,
        revokedAt: null,
        absoluteExpiresAt: trusted({ $gt: new Date() }),
      })
      .sort({ lastActivityAt: -1 })
      .limit(50)
      .exec();
    return rows.map((session) => ({
      id: session.id,
      realm: session.realm,
      deviceLabel: session.deviceLabel,
      lastActivityAt: session.lastActivityAt,
      createdAt: session.createdAt,
      current: session.id === currentId,
    }));
  }

  private isActive(session: SessionDocument, now: Date): boolean {
    return (
      !session.revokedAt &&
      session.idleExpiresAt > now &&
      session.absoluteExpiresAt > now
    );
  }

  private invalid(): never {
    throw new UnauthorizedException("Session is invalid or expired.");
  }
}
