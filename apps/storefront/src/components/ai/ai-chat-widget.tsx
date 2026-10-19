"use client";

import { MessageCircle, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { sendAiMessage } from "@/lib/ai-client";
import { AiChatPanel } from "./ai-chat-panel";
import type { AiUiMessage } from "./ai-message-list";

const hiddenRoutes = ["/cart", "/checkout", "/order-confirmation"];

export function AiChatWidget() {
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiUiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Chào bạn. Tôi có thể giúp tìm sản phẩm FARTA theo màu, size và mức giá.",
    },
  ]);

  if (hiddenRoutes.some((route) => pathname.startsWith(route))) return null;

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  async function submit(message: string) {
    if (loading) return;
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: message },
    ]);
    setLoading(true);
    try {
      const result = await sendAiMessage({ message, conversationId });
      setConversationId(result.conversationId);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: result.message,
          products: result.products,
          error: result.status === "unavailable",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: "Trợ lý đang tạm thời không khả dụng. Bạn có thể tiếp tục khám phá tại trang Shop.",
          error: true,
        },
      ]);
    } finally {
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
        onSubmit={submit}
      />
    </>
  );
}
