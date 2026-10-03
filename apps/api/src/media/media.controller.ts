import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";

import { RequireAuth } from "../auth/decorators/auth-realm.decorator";
import { RequireCsrf } from "../auth/decorators/csrf.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
// Nest requires DTO classes as runtime decorator metadata.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { FinalizeMediaDto, MediaIdParamDto } from "./dto/media.dto";
import { MediaService } from "./media.service";

@Controller("admin/media")
@RequireAuth("STAFF")
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Get() @RequirePermissions("media.read") list() {
    return this.media.list();
  }

  @Post("upload-authorizations")
  @RequirePermissions("media.create")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  authorizeUpload() {
    return this.media.authorizeUpload();
  }

  @Post("finalize")
  @RequirePermissions("media.create")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  finalize(@Body() input: FinalizeMediaDto, @Req() request: Request) {
    return this.media.finalize(input, this.actor(request));
  }

  @Delete(":mediaId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("media.archive")
  @RequireCsrf({ realm: "STAFF", binding: "SESSION" })
  archive(@Param() params: MediaIdParamDto, @Req() request: Request) {
    return this.media.archive(params.mediaId, this.actor(request));
  }

  private actor(request: Request) {
    if (!request.principal) throw new Error("Authenticated principal missing.");
    return { userId: request.principal.userId, requestId: String(request.id) };
  }
}
