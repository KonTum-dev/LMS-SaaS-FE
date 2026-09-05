/** Normalize user-entered text for full, client-side Vietnamese/English lists. */
export function normalizeListSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function listPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

export function listPageSizes(currentSize: number): number[] {
  return [...new Set([10, 20, 50, 100, currentSize])]
    .filter((size) => Number.isInteger(size) && size > 0 && size <= 100)
    .sort((first, second) => first - second);
}
