import { ApiFailure } from "./api";

const localizedMessages: Readonly<Record<string, string>> = {
  AUTH_INVALID_CREDENTIALS: "Thông tin đăng nhập không hợp lệ.",
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiFailure)
    return localizedMessages[error.code] ?? error.message;
  return "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
}
