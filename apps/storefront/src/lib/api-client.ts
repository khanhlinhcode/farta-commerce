import type { ApiError } from "@farta/types";

export class ApiClientError extends Error {
  constructor(
    public readonly payload: ApiError,
    public readonly status: number,
  ) {
    super(payload.error.message);
    this.name = "ApiClientError";
  }
}

export async function apiRequest<T>(
  path: `/${string}`,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: { Accept: "application/json", ...init?.headers },
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new ApiClientError(body as ApiError, response.status);
  return body as T;
}

export function customerCsrfHeaders(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const cookies = Object.fromEntries(
    document.cookie.split(";").flatMap((entry) => {
      const separator = entry.indexOf("=");
      if (separator < 0) return [];
      return [
        [
          decodeURIComponent(entry.slice(0, separator).trim()),
          decodeURIComponent(entry.slice(separator + 1)),
        ],
      ];
    }),
  );
  const token =
    cookies["__Secure-farta_customer_csrf"] ?? cookies.farta_customer_csrf;
  return token ? { "x-csrf-token": token } : {};
}
