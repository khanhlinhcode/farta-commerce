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
