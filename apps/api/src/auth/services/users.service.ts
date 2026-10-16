import {
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import type { AuthRealm, AuthRole, Permission } from "../auth.constants";
import { AuditService } from "../../audit/audit.service";
import { ApiException } from "../../common/api-exception";
import { User, type UserDocument } from "../schemas/user.schema";

export type SafeUser = {
  id: string;
  email: string;
  displayName: string;
  roles: AuthRole[];
  permissions: Permission[];
  rolesVersion: number;
  onboardingCompleted: boolean;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  normalizeEmail(email: string): string {
    return email.trim().normalize("NFKC").toLowerCase();
  }

  async createCustomer(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<UserDocument> {
    try {
      return await this.users.create({
        normalizedEmail: this.normalizeEmail(input.email),
        displayName: input.displayName.trim(),
        passwordHash: input.passwordHash,
        roles: ["CUSTOMER"],
        permissions: [],
        status: "ACTIVE",
        rolesVersion: 1,
        onboardingCompletedAt: null,
      });
    } catch (error) {
      if (this.isDuplicateKey(error))
        throw new ConflictException("An account already exists.");
      throw error;
    }
  }

  async createDevelopmentOwner(input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<UserDocument> {
    try {
      return await this.users.create({
        normalizedEmail: this.normalizeEmail(input.email),
        displayName: input.displayName.trim(),
        passwordHash: input.passwordHash,
        roles: ["OWNER"],
        permissions: [],
        status: "ACTIVE",
        rolesVersion: 1,
        onboardingCompletedAt: null,
      });
    } catch (error) {
      if (this.isDuplicateKey(error))
        throw new ConflictException("An account already exists.");
      throw error;
    }
  }

  findForLogin(email: string): Promise<UserDocument | null> {
    return this.users
      .findOne({ normalizedEmail: this.normalizeEmail(email) })
      .select("+passwordHash")
      .exec();
  }

  findActiveById(userId: string): Promise<UserDocument | null> {
    return this.users.findOne({ _id: userId, status: "ACTIVE" }).exec();
  }

  async updateCustomerProfile(
    userId: string,
    displayName: string,
    requestId: string,
  ): Promise<SafeUser> {
    const user = await this.users.findOneAndUpdate(
      { _id: userId, status: "ACTIVE", roles: "CUSTOMER" },
      { $set: { displayName: displayName.trim() } },
      { returnDocument: "after" },
    );
    if (!user) this.customerNotFound();
    await this.audit.record({
      action: "customer.profile.update",
      resourceType: "User",
      resourceId: user.id,
      actorId: user.id,
      requestId,
    });
    return this.toSafeUser(user);
  }

  async completeCustomerOnboarding(
    userId: string,
    requestId: string,
  ): Promise<SafeUser> {
    const completed = await this.users.findOneAndUpdate(
      {
        _id: userId,
        status: "ACTIVE",
        roles: "CUSTOMER",
        onboardingCompletedAt: null,
      },
      { $set: { onboardingCompletedAt: new Date() } },
      { returnDocument: "after" },
    );
    const user = completed ?? (await this.findActiveById(userId));
    if (!user || !user.roles.includes("CUSTOMER")) this.customerNotFound();
    if (completed) {
      await this.audit.record({
        action: "customer.onboarding.complete",
        resourceType: "User",
        resourceId: user.id,
        actorId: user.id,
        requestId,
      });
    }
    return this.toSafeUser(user);
  }

  supportsRealm(user: UserDocument, realm: AuthRealm): boolean {
    return realm === "CUSTOMER"
      ? user.roles.includes("CUSTOMER")
      : user.roles.some((role) => role !== "CUSTOMER");
  }

  toSafeUser(user: UserDocument): SafeUser {
    return {
      id: user.id,
      email: user.normalizedEmail,
      displayName: user.displayName,
      roles: [...user.roles],
      permissions: [...user.permissions],
      rolesVersion: user.rolesVersion,
      onboardingCompleted: Boolean(user.onboardingCompletedAt),
    };
  }

  private isDuplicateKey(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === 11000
    );
  }

  private customerNotFound(): never {
    throw new ApiException(
      HttpStatus.UNAUTHORIZED,
      "AUTH_SESSION_INVALID",
      "Session is invalid or expired.",
    );
  }
}
