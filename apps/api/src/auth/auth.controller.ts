import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { ApiException } from "../common/api-exception";
import type { AuthRealm } from "./auth.constants";
import { RequireAuth } from "./decorators/auth-realm.decorator";
import { RequireCsrf } from "./decorators/csrf.decorator";
import { RateLimit } from "./decorators/rate-limit.decorator";
// Nest uses these classes as runtime decorator/injection metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LoginDto } from "./dto/login.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RegisterDto } from "./dto/register.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SessionParamDto } from "./dto/session-param.dto";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateCustomerProfileDto } from "./dto/customer-profile.dto";
import { AuthService, type AuthResult } from "./services/auth.service";
import { AuthCookieService } from "./services/cookie.service";
import { CsrfService } from "./services/csrf.service";
import { SessionsService } from "./services/sessions.service";

abstract class RealmAuthController {
  protected abstract readonly realm: AuthRealm;

  constructor(
    protected readonly auth: AuthService,
    protected readonly sessions: SessionsService,
    protected readonly cookies: AuthCookieService,
    protected readonly csrf: CsrfService,
  ) {}

  protected issueCsrf(response: Response) {
    const csrfToken = this.csrf.issue(`preauth:${this.realm}`);
    this.cookies.setCsrf(response, this.realm, csrfToken);
    return { csrfToken };
  }

  protected async login(input: LoginDto, request: Request, response: Response) {
    return this.complete(
      await this.auth.login(input, this.realm, this.deviceLabel(request)),
      response,
    );
  }

  protected async refresh(request: Request, response: Response) {
    const credential = this.cookies.read(request, "refresh", this.realm);
    if (!credential)
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "AUTH_REFRESH_MISSING",
        "Refresh credential is required.",
      );
    return this.complete(
      await this.auth.refresh(credential, this.realm),
      response,
    );
  }

  protected async logout(request: Request, response: Response): Promise<void> {
    const principal = this.principal(request);
    await this.sessions.revoke(
      principal.sessionId,
      principal.userId,
      "USER_LOGOUT",
    );
    this.cookies.clear(response, this.realm);
  }

  protected async logoutAll(
    request: Request,
    response: Response,
  ): Promise<void> {
    const principal = this.principal(request);
    await this.sessions.revokeAll(
      principal.userId,
      this.realm,
      "USER_LOGOUT_ALL",
    );
    this.cookies.clear(response, this.realm);
  }

  protected async currentUser(request: Request) {
    return {
      user: await this.auth.currentUser(this.principal(request).userId),
    };
  }

  protected async listSessions(request: Request) {
    const principal = this.principal(request);
    return {
      sessions: await this.sessions.list(
        principal.userId,
        this.realm,
        principal.sessionId,
      ),
    };
  }

  protected async revokeSession(
    params: SessionParamDto,
    request: Request,
  ): Promise<void> {
    const principal = this.principal(request);
    const revoked = await this.sessions.revoke(
      params.sessionId,
      principal.userId,
      "USER_REVOKED_DEVICE",
    );
    if (!revoked)
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "SESSION_NOT_FOUND",
        "Session was not found.",
      );
  }

  protected complete(result: AuthResult, response: Response) {
    this.cookies.setCredentials(
      response,
      this.realm,
      result.accessToken,
      result.refreshToken,
      result.csrfToken,
    );
    return { user: result.user, csrfToken: result.csrfToken };
  }

  protected principal(request: Request): Express.AuthPrincipal {
    if (!request.principal)
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        "AUTH_REQUIRED",
        "Authentication is required.",
      );
    return request.principal;
  }

  protected deviceLabel(request: Request): string | null {
    const userAgent = request.header("user-agent")?.trim();
    return userAgent ? userAgent.slice(0, 160) : null;
  }
}

@Controller("auth/customer")
export class CustomerAuthController extends RealmAuthController {
  protected readonly realm = "CUSTOMER" as const;

  constructor(
    @Inject(AuthService) auth: AuthService,
    @Inject(SessionsService) sessions: SessionsService,
    @Inject(AuthCookieService) cookies: AuthCookieService,
    @Inject(CsrfService) csrf: CsrfService,
  ) {
    super(auth, sessions, cookies, csrf);
  }

  @Get("csrf")
  csrfToken(@Res({ passthrough: true }) response: Response) {
    return this.issueCsrf(response);
  }

  @Post("register")
  @RateLimit("AUTH_LOGIN")
  @RequireCsrf({ realm: "CUSTOMER", binding: "PRE_AUTH" })
  register(
    @Body() input: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth
      .registerCustomer(input, this.deviceLabel(request))
      .then((result) => this.complete(result, response));
  }

  @Post("login")
  @RateLimit("AUTH_LOGIN")
  @RequireCsrf({ realm: "CUSTOMER", binding: "PRE_AUTH" })
  customerLogin(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.login(input, request, response);
  }

  @Post("refresh")
  @RateLimit("AUTH_REFRESH")
  @RequireCsrf({ realm: "CUSTOMER", binding: "REFRESH" })
  customerRefresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.refresh(request, response);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuth("CUSTOMER")
  @RequireCsrf({ realm: "CUSTOMER", binding: "SESSION" })
  customerLogout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.logout(request, response);
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuth("CUSTOMER")
  @RequireCsrf({ realm: "CUSTOMER", binding: "SESSION" })
  customerLogoutAll(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.logoutAll(request, response);
  }

  @Get("me")
  @RequireAuth("CUSTOMER")
  me(@Req() request: Request) {
    return this.currentUser(request);
  }

  @Patch("profile")
  @RequireAuth("CUSTOMER")
  @RequireCsrf({ realm: "CUSTOMER", binding: "SESSION" })
  updateProfile(
    @Body() input: UpdateCustomerProfileDto,
    @Req() request: Request,
  ) {
    const principal = this.principal(request);
    return this.auth.updateCustomerProfile(
      principal.userId,
      input,
      String(request.id),
    );
  }

  @Post("onboarding/complete")
  @RequireAuth("CUSTOMER")
  @RequireCsrf({ realm: "CUSTOMER", binding: "SESSION" })
  completeOnboarding(@Req() request: Request) {
    const principal = this.principal(request);
    return this.auth.completeCustomerOnboarding(
      principal.userId,
      String(request.id),
    );
  }

  @Get("sessions")
  @RequireAuth("CUSTOMER")
  customerSessions(@Req() request: Request) {
    return this.listSessions(request);
  }

  @Delete("sessions/:sessionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuth("CUSTOMER")
  @RequireCsrf({ realm: "CUSTOMER", binding: "SESSION" })
  removeCustomerSession(
    @Param() params: SessionParamDto,
    @Req() request: Request,
  ) {
    return this.revokeSession(params, request);
  }
}

@Controller("auth/staff")
export class StaffAuthController extends RealmAuthController {
  protected readonly realm = "STAFF" as const;

  constructor(
    @Inject(AuthService) auth: AuthService,
    @Inject(SessionsService) sessions: SessionsService,
    @Inject(AuthCookieService) cookies: AuthCookieService,
    @Inject(CsrfService) csrf: CsrfService,
  ) {
    super(auth, sessions, cookies, csrf);
  }

  @Get("csrf")
  csrfToken(@Res({ passthrough: true }) response: Response) {
    return this.issueCsrf(response);
  }

  @Post("login")
  @RateLimit("AUTH_LOGIN")
  @RequireCsrf({ realm: "STAFF", binding: "PRE_AUTH" })
  staffLogin(
    @Body() input: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.login(input, request, response);
  }

  @Post("refresh")
  @RateLimit("AUTH_REFRESH")
  @RequireCsrf({ realm: "STAFF", binding: "REFRESH" })
  staffRefresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.refresh(request, response);
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuth("STAFF")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  staffLogout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.logout(request, response);
  }

  @Post("logout-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuth("STAFF")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  staffLogoutAll(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.logoutAll(request, response);
  }

  @Get("me")
  @RequireAuth("STAFF")
  me(@Req() request: Request) {
    return this.currentUser(request);
  }

  @Get("sessions")
  @RequireAuth("STAFF")
  staffSessions(@Req() request: Request) {
    return this.listSessions(request);
  }

  @Delete("sessions/:sessionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuth("STAFF")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  removeStaffSession(
    @Param() params: SessionParamDto,
    @Req() request: Request,
  ) {
    return this.revokeSession(params, request);
  }
}
