import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";

import { AuditModule } from "../audit/audit.module";
import { CustomerAuthController, StaffAuthController } from "./auth.controller";
import { AuthenticationGuard } from "./guards/authentication.guard";
import { CsrfGuard } from "./guards/csrf.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RateLimitGuard } from "./guards/rate-limit.guard";
import { Session, SessionSchema } from "./schemas/session.schema";
import { User, UserSchema } from "./schemas/user.schema";
import {
  ExternalIdentity,
  ExternalIdentitySchema,
} from "./schemas/external-identity.schema";
import { OAuthProviderConfigService } from "./oauth/oauth-provider-config.service";
import { OAuthTransactionService } from "./oauth/oauth-transaction.service";
import { AuthService } from "./services/auth.service";
import { AuthCookieService } from "./services/cookie.service";
import { CsrfService } from "./services/csrf.service";
import { PasswordService } from "./services/password.service";
import { PermissionsService } from "./services/permissions.service";
import { SessionsService } from "./services/sessions.service";
import { TokenService } from "./services/token.service";
import { UsersService } from "./services/users.service";

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: ExternalIdentity.name, schema: ExternalIdentitySchema },
    ]),
  ],
  controllers: [CustomerAuthController, StaffAuthController],
  providers: [
    AuthService,
    AuthCookieService,
    CsrfService,
    PasswordService,
    OAuthProviderConfigService,
    OAuthTransactionService,
    PermissionsService,
    SessionsService,
    TokenService,
    UsersService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [
    AuthCookieService,
    CsrfService,
    OAuthProviderConfigService,
    OAuthTransactionService,
    PasswordService,
    PermissionsService,
    SessionsService,
    TokenService,
    UsersService,
  ],
})
export class AuthModule {}
