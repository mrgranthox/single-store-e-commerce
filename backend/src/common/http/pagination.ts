export type PaginationInput = {
  page: number;
  page_size: number;
};

type PaginationInputLike = Partial<PaginationInput> | null | undefined;

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const normalizePositiveInteger = (
  value: unknown,
  fallback: number,
  options?: { max?: number }
) => {
  const normalizedValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(normalizedValue)) {
    return fallback;
  }

  const integerValue = Math.trunc(normalizedValue);

  if (integerValue < 1) {
    return fallback;
  }

  if (options?.max && integerValue > options.max) {
    return options.max;
  }

  return integerValue;
};

export const normalizePagination = (input: PaginationInputLike): PaginationInput => ({
  page: normalizePositiveInteger(input?.page, DEFAULT_PAGE),
  page_size: normalizePositiveInteger(input?.page_size, DEFAULT_PAGE_SIZE, {
    max: MAX_PAGE_SIZE
  })
});

export const buildPagination = (input: PaginationInputLike) => {
  const pagination = normalizePagination(input);

  return {
    skip: (pagination.page - 1) * pagination.page_size,
    take: pagination.page_size
  };
};

export const buildPaginationPayload = (input: PaginationInputLike, totalItems: number) => {
  const pagination = normalizePagination(input);

  return {
    page: pagination.page,
    limit: pagination.page_size,
    totalItems,
    totalPages: Math.ceil(totalItems / pagination.page_size)
  };
};

export const paginateItems = <T>(items: T[], input: PaginationInputLike) => {
  const pagination = normalizePagination(input);

  return items.slice(
    (pagination.page - 1) * pagination.page_size,
    pagination.page * pagination.page_size
  );
};
