import { ApiException } from "../common/api-exception";
import { HttpStatus } from "@nestjs/common";
import { Types } from "mongoose";

export function normalizeSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function normalizeSku(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function objectId(
  value: string,
  code = "INVALID_IDENTIFIER",
): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new ApiException(HttpStatus.BAD_REQUEST, code, "Invalid identifier.");
  }
  return new Types.ObjectId(value);
}

export function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11_000
  );
}
