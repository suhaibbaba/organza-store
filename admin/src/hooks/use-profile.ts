import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupportedLanguage } from "@store/shared/types/language";
import { PROFILE_QUERY_KEY, PROFILE_SESSIONS_QUERY_KEY, SESSION_QUERY_KEY } from "@/constants/api";
import { USERS_LIST_QUERY_KEY } from "@/constants/users";
import {
  changePassword,
  fetchProfile,
  fetchProfileSessions,
  revokeOtherProfileSessions,
  revokeProfileSession,
  updateProfile,
} from "@/lib/api/profile";
import { useSession } from "@/components/providers/session-provider";

export function useProfileQuery() {
  return useQuery({ queryKey: PROFILE_QUERY_KEY, queryFn: fetchProfile });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY, profile);
      void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: [USERS_LIST_QUERY_KEY] });
    },
  });
}

export function useChangePasswordMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: changePassword,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PROFILE_SESSIONS_QUERY_KEY }),
  });
}

export function useProfileSessionsQuery() {
  return useQuery({ queryKey: PROFILE_SESSIONS_QUERY_KEY, queryFn: fetchProfileSessions });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeProfileSession,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PROFILE_SESSIONS_QUERY_KEY }),
  });
}

export function useRevokeOtherSessionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeOtherProfileSessions,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PROFILE_SESSIONS_QUERY_KEY }),
  });
}

// Remembers a language switch on the account; never awaited, and a failure only means the account keeps its old choice.
export function useRememberLocale() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useCallback(
    (locale: SupportedLanguage) => {
      if (!user || user.locale === locale) return;
      updateProfile({ locale })
        .then((profile) => {
          queryClient.setQueryData(PROFILE_QUERY_KEY, profile);
          void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
        })
        .catch(() => undefined);
    },
    [user, queryClient]
  );
}
