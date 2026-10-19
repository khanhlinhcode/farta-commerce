import type { AiProductReference } from "@farta/types";

import { AiProductResults } from "./ai-product-results";

export type AiUiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  products?: readonly AiProductReference[];
  error?: boolean;
};

export function AiMessageList({
  messages,
  onProductNavigate,
}: {
  messages: readonly AiUiMessage[];
  onProductNavigate: () => void;
}) {
  return (
    <div
      className="ai-message-list"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.map((message) => (
        <div
          className={`ai-message ai-message--${message.role}${message.error ? " is-error" : ""}`}
          key={message.id}
        >
          <p>{message.text}</p>
          <AiProductResults
            products={message.products ?? []}
            onNavigate={onProductNavigate}
          />
        </div>
      ))}
    </div>
  );
}
