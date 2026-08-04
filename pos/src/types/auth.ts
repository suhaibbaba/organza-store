import type { Role } from "@shared/types/role";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}

export interface Session {
  user: SessionUser;
  token: string;
}
