import { Router } from 'express';
import { authenticateApiKey } from './apiKey.middleware.js';
import type { AuthRequest, ApiResponse } from '../../types/index.js';

// Public API v1 (Phase 8). Stable, versioned surface authenticated via API keys.
// Starts with a ping that echoes the calling app + scopes to prove key auth.
export const v1Router = Router();

v1Router.use(authenticateApiKey);

v1Router.get('/ping', (req: AuthRequest, res) => {
  return res.json({
    ok: true,
    data: { pong: true, appId: req.apiKey?.appId, scopes: req.apiKey?.scopes || [] },
  } satisfies ApiResponse);
});

export default v1Router;
