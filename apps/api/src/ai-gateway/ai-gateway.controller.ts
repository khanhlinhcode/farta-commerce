import {
  Body,
  Controller,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { OptionalAuth } from "../auth/decorators/auth-realm.decorator";
import { RateLimit } from "../auth/decorators/rate-limit.decorator";
import { AiChatOriginGuard } from "./ai-chat-origin.guard";
// DTO classes are required as runtime decorator metadata by Nest.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AiChatDto } from "./dto/ai-chat.dto";
import { AiGatewayService } from "./ai-gateway.service";

@Controller("ai")
@OptionalAuth("CUSTOMER")
export class AiGatewayController {
  constructor(
    @Inject(AiGatewayService) private readonly gateway: AiGatewayService,
  ) {}

  @Post("chat")
  @RateLimit("AI_CHAT")
  @UseGuards(AiChatOriginGuard)
  chat(
    @Body() input: AiChatDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.gateway.chat(
      input.message,
      input.conversationId,
      request,
      response,
    );
  }
}
