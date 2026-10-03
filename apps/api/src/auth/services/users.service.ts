import { ConflictException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import type { AuthRealm, AuthRole, Permission } from "../auth.constants";
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
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

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
}
