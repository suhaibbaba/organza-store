import { useSearchParams } from "@ui/lib/search-params";
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "@ui/components/table";

export interface PageParams {
  readonly page: number;
  readonly perPage: number;
  readonly setPage: (page: number) => void;
  readonly setPerPage: (perPage: number) => void;
  readonly resetPage: () => void;
}

export function usePageParams(
  options: readonly number[] = PER_PAGE_OPTIONS,
  scope?: string,
): PageParams {
  const [params, setParams] = useSearchParams();
  const pageKey = scope === undefined ? "page" : `${scope}Page`;
  const perPageKey = scope === undefined ? "perPage" : `${scope}PerPage`;

  const page = Math.max(1, Number.parseInt(params.get(pageKey) ?? "", 10) || 1);
  const requested = Number.parseInt(params.get(perPageKey) ?? "", 10);
  const perPage = options.includes(requested) ? requested : DEFAULT_PER_PAGE;

  const write = (change: (next: URLSearchParams) => void): void => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);

        change(next);

        return next;
      },
      { replace: true },
    );
  };

  const putPage = (next: URLSearchParams, value: number): void => {
    if (value <= 1) {
      next.delete(pageKey);
    } else {
      next.set(pageKey, String(value));
    }
  };

  return {
    page,
    perPage,
    setPage: (value) => write((next) => putPage(next, value)),
    resetPage: () => write((next) => putPage(next, 1)),
    setPerPage: (value) =>
      write((next) => {
        putPage(next, 1);

        if (value === DEFAULT_PER_PAGE) {
          next.delete(perPageKey);
        } else {
          next.set(perPageKey, String(value));
        }
      }),
  };
}
