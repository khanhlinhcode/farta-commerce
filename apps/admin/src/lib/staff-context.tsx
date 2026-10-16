import { createContext, useContext, type ReactNode } from "react";

import type { AdminUser } from "./api";

const StaffContext = createContext<AdminUser | null>(null);

export function StaffProvider({
  user,
  children,
}: {
  user: AdminUser;
  children: ReactNode;
}) {
  return <StaffContext value={user}>{children}</StaffContext>;
}

export function useStaff(): AdminUser {
  const user = useContext(StaffContext);
  if (!user) throw new Error("StaffProvider is missing.");
  return user;
}
