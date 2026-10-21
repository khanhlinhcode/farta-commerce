"use client";

import { MessageCircle, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { sendAiMessage } from "@/lib/ai-client";
import { AiChatPanel } from "./ai-chat-panel";
import type { AiUiMessage } from "./ai-message-list";

const hiddenRoutes = ["/cart", "/checkout", "/order-confirmation"];
const requestTimeoutMs = 65_000;

const retryableErrorCodes = new Set([
  "AI_PROVIDER_FAILED",
  "AI_PROVIDER_RATE_LIMIT",
  "AI_PROVIDER_TIMEOUT",
  "AI_COMMERCE_TOOL_UNAVAILABLE",
]);

export function AiChatWidget() {
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiUiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Chào bạn. Tôi có thể giúp tìm sản phẩm FARTA theo màu, size và mức giá.",
    },
  ]);

  useEffect(
    () => () => {
      requestControllerRef.current?.abort();
    },
    [],
  );

  if (hiddenRoutes.some((route) => pathname.startsWith(route))) return null;

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function submit(message: string, isRetry = false) {
    if (loading) return;
    setRetryMessage(null);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: message },
    ]);
    setLoading(true);
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const timeout = window.setTimeout(
      () => controller.abort(),
      requestTimeoutMs,
    );
    try {
      const result = await sendAiMessage(
        { message, conversationId },
        controller.signal,
      );
      setConversationId(result.conversationId);
      const unavailable = result.status === "unavailable";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: result.message,
          products: result.products,
          error: unavailable,
          ...(result.status === "completed"
            ? { source: result.route === "agent" ? "advisor" : "catalog" }
            : {}),
        },
      ]);
      if (
        unavailable &&
        !isRetry &&
        result.error &&
        retryableErrorCodes.has(result.error.code)
      ) {
        setRetryMessage(message);
      }
    } catch (error) {
      const timedOut =
        error instanceof DOMException && error.name === "AbortError";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: timedOut
            ? "Yêu cầu đã hết thời gian chờ. Bạn có thể thử lại một lần hoặc tiếp tục khám phá tại trang Shop."
            : "Trợ lý đang tạm thời không khả dụng. Bạn có thể thử lại một lần hoặc tiếp tục khám phá tại trang Shop.",
          error: true,
        },
      ]);
      if (!isRetry) setRetryMessage(message);
    } finally {
      window.clearTimeout(timeout);
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
      setLoading(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="ai-chat-trigger"
        onClick={() => setOpen(true)}
        aria-label="Mở FARTA Product Advisor"
        aria-haspopup="dialog"
      >
        <Sparkles aria-hidden="true" size={15} />
        <span>Hỏi FARTA</span>
        <MessageCircle aria-hidden="true" size={18} />
      </button>
      <AiChatPanel
        open={open}
        loading={loading}
        messages={messages}
        onClose={close}
        onRetry={retryMessage ? () => submit(retryMessage, true) : null}
        onSubmit={submit}
      />
    </>
  );
}
