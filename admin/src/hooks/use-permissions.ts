import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PermissionMatrixPayload } from "@organza/shared/types/permission";
import { applyPermissionMatrixPayload } from "@organza/shared/lib/permissions";
import { PERMISSIONS_QUERY_KEY } from "@/constants/api";
import { updateRolePermissions } from "@/lib/api/permissions";

/**
 * Flipping one grant.
 *
 * The response is the whole matrix as the server now sees it, so it is
 * written straight into the cache AND straight into `can()` — the screen the
 * Admin is standing on rearranges itself the moment the change lands, which
 * is the honest thing for a screen about permissions to do.
 *
 * No optimistic update. This is a permission: showing it as switched off
 * before the server has agreed is showing somebody a shop rule that may not
 * be true, and the request takes a few hundred milliseconds.
 */
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
