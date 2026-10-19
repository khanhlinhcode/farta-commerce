import { Module } from "@nestjs/common";

import { AiToolsModule } from "../ai-tools/ai-tools.module";
import { AuthModule } from "../auth/auth.module";
import { AiChatOriginGuard } from "./ai-chat-origin.guard";
import { AiConversationCredentialService } from "./ai-conversation-credential.service";
import { AiConversationService } from "./ai-conversation.service";
import { AiGatewayController } from "./ai-gateway.controller";
import { AiGatewayService } from "./ai-gateway.service";

@Module({
  imports: [AuthModule, AiToolsModule],
  controllers: [AiGatewayController],
  providers: [
    AiGatewayService,
    AiConversationService,
    AiConversationCredentialService,
    AiChatOriginGuard,
  ],
})
export class AiGatewayModule {}
