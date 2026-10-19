import { Send } from "lucide-react";
import { useState, type FormEvent, type RefObject } from "react";

export function AiMessageInput({
  disabled,
  inputRef,
  onSubmit,
}: {
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onSubmit: (message: string) => void;
}) {
  const [value, setValue] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const message = value.trim();
    if (!message || disabled) return;
    onSubmit(message);
    setValue("");
  }
  return (
    <form className="ai-message-input" onSubmit={submit}>
      <label className="sr-only" htmlFor="farta-ai-message">
        Câu hỏi về sản phẩm
      </label>
      <input
        ref={inputRef}
        id="farta-ai-message"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Tìm theo màu, size, mức giá…"
        maxLength={1000}
        disabled={disabled}
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        aria-label="Gửi câu hỏi"
      >
        <Send aria-hidden="true" size={18} />
      </button>
    </form>
  );
}
