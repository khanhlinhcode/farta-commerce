import {
  HttpStatus,
  Inject,
  Injectable,
  type OnModuleInit,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";

import type { AuthRealm } from "../auth.constants";
import { ApiException } from "../../common/api-exception";
import type { LoginDto } from "../dto/login.dto";
import type { RegisterDto } from "../dto/register.dto";
import type { UserDocument } from "../schemas/user.schema";
import { CsrfService } from "./csrf.service";
import { PasswordService } from "./password.service";
import { SessionsService } from "./sessions.service";
import { TokenService } from "./token.service";
import { UsersService } from "./users.service";
import { type SafeUser } from "./users.service";

export type AuthResult = {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
};

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyPasswordHash = "";

  constructor(
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(CsrfService) private readonly csrf: CsrfService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyPasswordHash = await this.passwords.hash(
      randomBytes(32).toString("base64url"),
    );
  }

  async registerCustomer(
    input: RegisterDto,
    deviceLabel: string | null,
  ): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.users.createCustomer({
      email: input.email,
      displayName: input.displayName,
      passwordHash,
    });
    return this.createAuthenticatedSession(user, "CUSTOMER", deviceLabel);
  }

  async login(
    input: LoginDto,
    realm: AuthRealm,
    deviceLabel: string | null,
  ): Promise<AuthResult> {
    const user = await this.users.findForLogin(input.email);
    const passwordHash = user?.passwordHash ?? this.dummyPasswordHash;
    const passwordValid = await this.passwords.verify(
      input.password,
      passwordHash,
    );
    if (
      !user ||
      !passwordValid ||
      user.status !== "ACTIVE" ||
      !this.users.supportsRealm(user, realm)
    ) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "AUTH_INVALID_CREDENTIALS",
        "Invalid credentials.",
      );
    }
    return this.createAuthenticatedSession(user, realm, deviceLabel);
  }

  async refresh(rawRefresh: string, realm: AuthRealm): Promise<AuthResult> {
    const rotated = await this.sessions.rotate(rawRefresh, realm);
    const user = await this.users.findActiveById(
      rotated.session.userId.toString(),
    );
    if (
      !user ||
      !this.users.supportsRealm(user, realm) ||
      user.rolesVersion !== rotated.session.rolesVersion
    ) {
      await this.sessions.revoke(
        rotated.session.id,
        rotated.session.userId.toString(),
        "IDENTITY_CHANGED",
      );
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "AUTH_SESSION_INVALID",
        "Session is invalid or expired.",
      );
    }
    const accessToken = await this.tokens.issueAccessToken({
      userId: user.id,
      sessionId: rotated.session.id,
      realm,
      rolesVersion: user.rolesVersion,
    });
    return {
      user: this.users.toSafeUser(user),
      accessToken,
      refreshToken: rotated.refreshToken,
      csrfToken: this.csrf.issue(`session:${rotated.session.id}`),
    };
  }

  async currentUser(userId: string): Promise<SafeUser> {
    const user = await this.users.findActiveById(userId);
    if (!user)
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "AUTH_SESSION_INVALID",
        "Session is invalid or expired.",
      );
    return this.users.toSafeUser(user);
  }

  private async createAuthenticatedSession(
    user: UserDocument,
    realm: AuthRealm,
    deviceLabel: string | null,
  ): Promise<AuthResult> {
    const created = await this.sessions.create({
      userId: user.id,
      realm,
      rolesVersion: user.rolesVersion,
      deviceLabel,
    });
    const accessToken = await this.tokens.issueAccessToken({
      userId: user.id,
      sessionId: created.session.id,
      realm,
      rolesVersion: user.rolesVersion,
    });
    return {
      user: this.users.toSafeUser(user),
      accessToken,
      refreshToken: created.refreshToken,
      csrfToken: this.csrf.issue(`session:${created.session.id}`),
    };
  }
}
