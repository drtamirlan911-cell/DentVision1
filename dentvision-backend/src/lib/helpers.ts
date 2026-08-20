import { v4 as uuid } from 'uuid';

export function uid(): string {
  return uuid();
}

export function paginate(page: number, limit: number) {
  const skip = (page - 1) * limit;
  return { skip, take: limit };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export function sanitizeString(s: string | undefined | null): string {
  return (s || '').trim();
}

/**
 * Strips HTML tags from a plain-text field (names, titles, short labels —
 * not rich-text content, which has its own handling elsewhere). The frontend
 * already escapes on render, so this isn't closing an active XSS hole; it's
 * defense in depth for the other consumers of this data that don't go
 * through React — PDF exports, print views, emails.
 */
export function stripHtmlTags(s: string | undefined | null): string {
  return (s || '').replace(/<[^>]*>/g, '').trim();
}
