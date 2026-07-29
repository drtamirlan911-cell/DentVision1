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
      const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return res.status(400).json({ ok: false, error: errors.join(', ') });
    }
    req.body = result.data.body;
    req.query = result.data.query;
    req.params = result.data.params;
    next();
  };
}
