import type { Role } from "@prisma/client";

export interface AuthedUser {
  id: string;
  role: Role;
}

export interface SerializableUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string;
  whatsapp: string | null;
  idNumber: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
