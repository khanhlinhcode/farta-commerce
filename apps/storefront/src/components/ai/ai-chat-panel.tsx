import { Sparkles, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { AiChatStatus } from "./ai-chat-status";
import { AiMessageInput } from "./ai-message-input";
import { AiMessageList, type AiUiMessage } from "./ai-message-list";

const suggestions = [
  "Tìm áo màu đen size M",
  "Cho xem váy dưới 1 triệu",
  "Tìm sản phẩm màu kem",
] as const;

export function AiChatPanel({
  open,
  loading,
  messages,
  onClose,
  onRetry,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  messages: readonly AiUiMessage[];
  onClose: () => void;
  onRetry: (() => void) | null;
  onSubmit: (message: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="ai-chat-panel"
      aria-labelledby="farta-ai-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <header>
        <div>
          <span className="ai-chat-panel__mark" aria-hidden="true">
            <Sparkles size={17} />
          </span>
          <div>
            <p>FARTA</p>
            <h2 id="farta-ai-title">Product Advisor</h2>
          </div>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Đóng trợ lý"
        >
          <X aria-hidden="true" size={20} />
        </button>
      </header>
      <p className="ai-chat-panel__notice">
        Sản phẩm, giá và tình trạng hàng được xác minh từ hệ thống FARTA.
      </p>
      <AiMessageList messages={messages} onProductNavigate={onClose} />
      {messages.length === 1 && (
        <div className="ai-chat-suggestions" aria-label="Câu hỏi gợi ý">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSubmit(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      <AiChatStatus loading={loading} />
      {onRetry && !loading && (
        <div className="ai-chat-retry">
          <button type="button" onClick={onRetry}>
            Thử lại yêu cầu gần nhất
          </button>
        </div>
      )}
      <AiMessageInput
        disabled={loading}
        inputRef={inputRef}
        onSubmit={onSubmit}
      />
    </dialog>
  );
}
