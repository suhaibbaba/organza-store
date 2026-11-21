"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import type { UpdateExpenseCategoryInput, UpdateExpenseInput } from "@store/shared/schemas/expense";
import { useCacheInvalidation } from "@/hooks/use-cache-invalidation";
import {
  createExpense,
  createExpenseCategory,
  deleteExpense,
  deleteExpenseCategory,
  fetchExpenseCategories,
  fetchExpenses,
  fetchExpenseSummary,
  updateExpense,
  updateExpenseCategory,
} from "@/lib/api/expenses";
import {
  EXPENSE_CATEGORIES_QUERY_KEY,
  EXPENSE_LIST_QUERY_KEY,
  EXPENSE_STALE_TIME_MS,
  EXPENSE_SUMMARY_QUERY_KEY,
} from "@/constants/expenses";
import type { ExpenseListFilters } from "@/types/expense";

export function useExpensesQuery(filters: ExpenseListFilters) {
  return useQuery({
    queryKey: [EXPENSE_LIST_QUERY_KEY, filters],
    queryFn: () => fetchExpenses(filters),
    staleTime: EXPENSE_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}

// Paging and sort don't change a total, so they stay out of the summary's key.
export function useExpenseSummaryQuery(filters: ExpenseListFilters) {
  const { preset, from, to, q, categoryId } = filters;
  return useQuery({
    queryKey: [EXPENSE_SUMMARY_QUERY_KEY, { preset, from, to, q, categoryId }],
    queryFn: () => fetchExpenseSummary(filters),
    staleTime: EXPENSE_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}

// The picker wants the live ones; the categories drawer and the list's names want every one.
export function useExpenseCategoriesQuery(includeInactive = true) {
  return useQuery({
    queryKey: [EXPENSE_CATEGORIES_QUERY_KEY, includeInactive],
    queryFn: () => fetchExpenseCategories(includeInactive),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateExpenseMutation() {
  const { expensesChanged } = useCacheInvalidation();
  return useMutation({ mutationFn: createExpense, onSuccess: () => expensesChanged() });
}

export function useUpdateExpenseMutation() {
  const { expensesChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExpenseInput }) => updateExpense(id, input),
    onSuccess: () => expensesChanged(),
  });
}

export function useDeleteExpenseMutation() {
  const { expensesChanged } = useCacheInvalidation();
  return useMutation({ mutationFn: deleteExpense, onSuccess: () => expensesChanged() });
}

export function useCreateExpenseCategoryMutation() {
  const { expenseCategoriesChanged } = useCacheInvalidation();
  return useMutation({ mutationFn: createExpenseCategory, onSuccess: () => expenseCategoriesChanged() });
}

export function useUpdateExpenseCategoryMutation() {
  const { expenseCategoriesChanged } = useCacheInvalidation();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateExpenseCategoryInput }) => updateExpenseCategory(id, input),
    onSuccess: () => expenseCategoriesChanged(),
  });
}

export function useDeleteExpenseCategoryMutation() {
  const { expenseCategoriesChanged } = useCacheInvalidation();
  return useMutation({ mutationFn: deleteExpenseCategory, onSuccess: () => expenseCategoriesChanged() });
}
