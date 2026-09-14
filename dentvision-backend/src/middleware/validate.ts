import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      const errors = result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({ ok: false, error: errors.join(', ') });
    }

    const data = result.data as {
      body?: Request['body'];
      query?: Request['query'];
      params?: Request['params'];
    };
    if (data.body !== undefined) req.body = data.body;
    if (data.query !== undefined) req.query = data.query;
    if (data.params !== undefined) req.params = data.params;
    next();
  };
}
