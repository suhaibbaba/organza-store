import type { User } from "@store/shared/types/user";
import type { Pagination } from "@store/shared/types/common";
import type { CreateUserInput, UpdateUserInput } from "@store/shared/schemas/user";
import { apiFetch } from "@/lib/api/client";
import type { UserListFilters } from "@/types/user";

function buildUserListQuery(filters: UserListFilters): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  params.set("sortBy", filters.sortBy);
  params.set("sortDir", filters.sortDir);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.role) params.set("role", filters.role);
  if (filters.isActive !== null) params.set("isActive", String(filters.isActive));
  return params.toString();
}

export async function fetchUsers(filters: UserListFilters): Promise<{ users: User[]; meta: Pagination | null }> {
  const query = buildUserListQuery(filters);
  const { data, meta } = await apiFetch<User[]>(`/api/users?${query}`);
  return { users: data, meta };
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const { data } = await apiFetch<User>("/api/users", { method: "POST", body: input });
  return data;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const { data } = await apiFetch<User>(`/api/users/${id}`, { method: "PATCH", body: input });
  return data;
}

// Not "removeUser": removing somebody normally means deactivating them via updateUser.
export async function deleteUser(id: string): Promise<void> {
  await apiFetch<{ id: string; deleted: boolean }>(`/api/users/${id}`, { method: "DELETE" });
}
