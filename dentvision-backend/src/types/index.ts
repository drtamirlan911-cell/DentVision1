import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  clinicId?: string;
  // Active SUPPLIER context (set when the user switched into a supplier workspace).
  supplierId?: string;
  supplierRole?: string;
  lecturerId?: string;
  isGuest?: boolean;
}

export interface ApiKeyContext {
  id: string;
  appId: string;
  scopes: string[];
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  apiKey?: ApiKeyContext;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  clinicId?: string;
  supplierId?: string;
  supplierRole?: string;
  lecturerId?: string;
  isGuest?: boolean;
}

export interface PaginatedQuery {
  page?: string;
  limit?: string;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}
