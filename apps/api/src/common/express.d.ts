declare global {
  namespace Express {
    interface AuthPrincipal {
      userId: string;
      sessionId: string;
      realm: "CUSTOMER" | "STAFF";
      roles: ReadonlyArray<"CUSTOMER" | "STAFF" | "ADMIN" | "OWNER">;
      permissions: ReadonlyArray<string>;
      rolesVersion: number;
    }

    interface Request {
      id: string;
      principal?: AuthPrincipal;
    }
  }
}

export {};
