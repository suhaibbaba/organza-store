import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PermissionMatrixPayload } from "@store/shared/types/permission";
import { applyPermissionMatrixPayload } from "@store/shared/lib/permissions";
import { PERMISSIONS_QUERY_KEY } from "@/constants/api";
import { updateRolePermissions } from "@/lib/api/permissions";

// No optimistic update: never show a shop rule the server hasn't agreed to; the response replaces the matrix.
export function useUpdateRolePermissionsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRolePermissions,
    onSuccess: (data: PermissionMatrixPayload) => {
      queryClient.setQueryData(PERMISSIONS_QUERY_KEY, data);
      applyPermissionMatrixPayload(data);
    },
  });
}
