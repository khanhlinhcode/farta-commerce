import type { AiCitation, AiProductReference } from "@farta/types";
import Link from "next/link";

import { AiProductResults } from "./ai-product-results";

export type AiUiMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  products?: readonly AiProductReference[];
  citations?: readonly AiCitation[];
  error?: boolean;
  source?: "catalog" | "advisor";
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
          {message.source && (
            <span className="ai-message__source">
              {message.source === "catalog"
                ? "Catalog FARTA đã xác minh"
                : "Tư vấn AI · sản phẩm đã xác minh"}
            </span>
          )}
          <p>{message.text}</p>
          <AiProductResults
            products={message.products ?? []}
            onNavigate={onProductNavigate}
          />
          {(message.citations?.length ?? 0) > 0 && (
            <ul className="ai-message__citations" aria-label="Nguồn tham khảo">
              {message.citations?.map((citation) => (
                <li key={citation.citationId}>
                  <Link
                    href={citation.canonicalPath}
                    onClick={onProductNavigate}
                  >
                    {citation.title}
                  </Link>
                  <p>{citation.excerpt}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
