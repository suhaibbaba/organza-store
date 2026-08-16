import type { User } from "@organza/shared/types/user";
import type { Pagination } from "@organza/shared/types/common";
import type { CreateUserInput, UpdateUserInput } from "@organza/shared/schemas/user";
import { apiFetch } from "@/lib/api/client";
import type { UserListFilters } from "@/types/user";

function buildUserListQuery(filters: UserListFilters, pageSize: number): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(pageSize));
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.role) params.set("role", filters.role);
  if (filters.isActive !== null) params.set("isActive", String(filters.isActive));
  return params.toString();
}

export async function fetchUsers(
  filters: UserListFilters,
  pageSize: number
): Promise<{ users: User[]; meta: Pagination | null }> {
  const query = buildUserListQuery(filters, pageSize);
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

/**
 * Erase an account outright — only ever possible for one that never did
 * anything (the API refuses the rest with `error.user.has_history`).
 *
 * Deliberately not called "removeUser": removing somebody from the shop
 * normally means DEACTIVATING them, which is an ordinary `updateUser` above.
 * The two must not be reachable through one word.
 */
export async function deleteUser(id: string): Promise<void> {
  await apiFetch<{ id: string; deleted: boolean }>(`/api/users/${id}`, { method: "DELETE" });
}
