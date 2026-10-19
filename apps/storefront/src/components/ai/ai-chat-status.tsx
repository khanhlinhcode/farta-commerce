import { LoaderCircle } from "lucide-react";

export function AiChatStatus({ loading }: { loading: boolean }) {
  if (!loading) return null;
  return (
    <p className="ai-chat-status" role="status">
      <LoaderCircle aria-hidden="true" size={16} />
      FARTA đang kiểm tra dữ liệu sản phẩm…
    </p>
  );
}
