import type { Role } from "@/types/role";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string;
  whatsapp: string | null;
  // SENSITIVE (CLAUDE.md rule 19): Admin only.
  idNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
