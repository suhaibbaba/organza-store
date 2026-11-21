import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { USERS_LIST_QUERY_KEY } from "@/constants/users";
import { createUser, deleteUser, fetchUsers, updateUser } from "@/lib/api/users";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import type { UserListFilters } from "@/types/user";

export function useUsersQuery(filters: UserListFilters) {
  return useQuery({
    queryKey: [USERS_LIST_QUERY_KEY, filters],
    queryFn: () => fetchUsers(filters),
    // Keeps the current rows on screen while the next page or filter loads.
    placeholderData: keepPreviousData,
  });
}

function useInvalidateUsers() {
  const { usersChanged } = useCacheInvalidation();
  return usersChanged;
}

export function useCreateUserMutation() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: createUser,
    onSuccess: invalidate,
  });
}

export function useUpdateUserMutation(id: string) {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (input: Parameters<typeof updateUser>[1]) => updateUser(id, input),
    onSuccess: invalidate,
  });
}

// The target id is per call, since it acts on whichever row was tapped.
export function useToggleUserActiveMutation() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateUser(id, { isActive }),
    onSuccess: invalidate,
  });
}

// Erasing for good, separate from deactivating; the API refuses it for anybody with history.
export function useDeleteUserMutation() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: invalidate,
  });
}
