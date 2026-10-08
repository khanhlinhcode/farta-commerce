import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { ClientSession, Model } from "mongoose";

import { AuditLog, type AuditLogDocument } from "./schemas/audit-log.schema";

export type AuditRecord = {
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string;
  requestId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogs: Model<AuditLogDocument>,
  ) {}

  async record(input: AuditRecord, session?: ClientSession): Promise<void> {
    const options = session ? { session } : {};
    await this.auditLogs.create(
      [
        {
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          actorId: input.actorId,
          requestId: input.requestId,
          changes:
            input.before === undefined && input.after === undefined
              ? null
              : { before: input.before ?? null, after: input.after ?? null },
          reason: input.reason ?? null,
        },
      ],
      options,
    );
  }

  async list(limit: number, resourceType?: string) {
    const items = await this.auditLogs
      .find(resourceType ? { resourceType } : {})
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .exec();
    return {
      items: items.map((item) => ({
        id: item.id,
        action: item.action,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        actorId: item.actorId.toString(),
        requestId: item.requestId,
        changes: item.changes,
        reason: item.reason,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  async listForResource(resourceType: string, resourceId: string, limit = 100) {
    const items = await this.auditLogs
      .find({ resourceType, resourceId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .exec();
    return items.map((item) => ({
      id: item.id,
      action: item.action,
      actorId: item.actorId.toString(),
      requestId: item.requestId,
      changes: item.changes,
      reason: item.reason,
      createdAt: item.createdAt.toISOString(),
    }));
  }
}
