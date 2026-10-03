export type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: ReadonlyArray<{ field: string; message: string }>;
  };
};

export type HealthStatus = {
  status: "ok" | "not_ready";
  requestId: string;
};

export type Realm = "CUSTOMER" | "STAFF";
export type Role = "CUSTOMER" | "STAFF" | "ADMIN" | "OWNER";
