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
