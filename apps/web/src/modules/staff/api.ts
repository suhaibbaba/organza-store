import type { CreateUserInput, Language, Role, UpdateUserInput } from '@organza/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@web/shared/lib/api-client';

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  language: Language;
  isActive: boolean;
  createdAt: string;
}

const KEY = ['staff'] as const;

export const useStaff = () =>
  useQuery({ queryKey: KEY, queryFn: () => api.get<StaffMember[]>('/staff') });

export function useSaveStaff() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; create?: CreateUserInput; update?: UpdateUserInput }) =>
      input.id
        ? api.patch<StaffMember>(`/staff/${input.id}`, input.update)
        : api.post<StaffMember>('/staff', input.create),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}
