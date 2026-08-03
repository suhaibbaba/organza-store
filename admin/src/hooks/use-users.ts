import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { USERS_LIST_PAGE_SIZE, USERS_LIST_QUERY_KEY } from "@/constants/users";
import { createUser, fetchUsers, updateUser } from "@/lib/api/users";
import type { UserListFilters } from "@/types/user";

export function useUsersQuery(filters: UserListFilters) {
  return useQuery({
    queryKey: [USERS_LIST_QUERY_KEY, filters],
    queryFn: () => fetchUsers(filters, USERS_LIST_PAGE_SIZE),
    // Keeps the current page's rows on screen while the next page/filter
    // loads, instead of flashing back to a loading state.
    placeholderData: keepPreviousData,
  });
}

function useInvalidateUsers() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: [USERS_LIST_QUERY_KEY] });
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

// Activate/deactivate acts on whichever card/row the staff member taps, so
// (unlike useUpdateUserMutation) the target id is supplied per call instead
// of fixed when the hook is created.
export function useToggleUserActiveMutation() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateUser(id, { isActive }),
    onSuccess: invalidate,
  });
}
