import { HttpStatus } from "@nestjs/common";

import { ApiException } from "../common/api-exception";

export function normalizeVietnamesePhone(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const local = compact.startsWith("+84")
    ? `0${compact.slice(3)}`
    : compact.startsWith("84")
      ? `0${compact.slice(2)}`
      : compact;
  if (!/^0[35789][0-9]{8}$/.test(local)) {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      "INVALID_PHONE",
      "The recipient phone number is invalid.",
    );
  }
  return `+84${local.slice(1)}`;
}
