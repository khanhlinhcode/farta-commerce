import type { AiChatRequest, AiChatResponse } from "@farta/types";

import { apiRequest } from "./api-client";

export function sendAiMessage(input: AiChatRequest): Promise<AiChatResponse> {
  return apiRequest<AiChatResponse>("/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
