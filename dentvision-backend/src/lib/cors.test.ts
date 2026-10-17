import { describe, expect, it, vi } from 'vitest';

vi.mock('../config.js', () => ({
  env: {
    NODE_ENV: 'test',
    CORS_ORIGIN: 'https://dent-vision1.vercel.app',
    FRONTEND_URL: undefined,
    VERCEL_TEAM_SLUG: undefined,
  },
}));

import { isOriginAllowedByPolicy } from './cors.js';

describe('isOriginAllowedByPolicy', () => {
  const production = {
    production: true,
    origins: ['https://dent-vision1.vercel.app'],
    vercelTeamSlug: 'team-dentvision',
  };

  it('allows an exact configured production origin', () => {
    expect(isOriginAllowedByPolicy('https://dent-vision1.vercel.app', production)).toBe(true);
  });

  it('rejects unrelated Vercel projects and lookalike origins', () => {
    expect(isOriginAllowedByPolicy('https://attacker.vercel.app', production)).toBe(false);
    expect(isOriginAllowedByPolicy('https://dent-vision1.vercel.app.attacker.example', production)).toBe(false);
  });

  it('allows only generated Vercel previews ending in the configured team slug', () => {
    expect(isOriginAllowedByPolicy('https://dentvision-git-security-team-dentvision.vercel.app', production)).toBe(true);
    expect(isOriginAllowedByPolicy('https://dentvision-git-security-other-team.vercel.app', production)).toBe(false);
  });

  it('rejects localhost, HTTP and missing origin in production', () => {
    expect(isOriginAllowedByPolicy('http://localhost:5173', production)).toBe(false);
    expect(isOriginAllowedByPolicy('https://localhost', production)).toBe(false);
    expect(isOriginAllowedByPolicy('http://dent-vision1.vercel.app', production)).toBe(false);
    expect(isOriginAllowedByPolicy(undefined, production)).toBe(false);
  });

  it('fails closed on missing preview team slug and wildcard origins', () => {
    expect(isOriginAllowedByPolicy('https://dentvision-git-main-team-dentvision.vercel.app', {
      ...production,
      vercelTeamSlug: undefined,
    })).toBe(false);
    expect(isOriginAllowedByPolicy('https://attacker.vercel.app', {
      ...production,
      origins: ['*'],
    })).toBe(false);
  });

  it('allows only explicit development localhost exceptions', () => {
    expect(isOriginAllowedByPolicy('http://localhost:5173', { production: false, origins: [] })).toBe(true);
    expect(isOriginAllowedByPolicy('http://localhost:9999', { production: false, origins: [] })).toBe(false);
    expect(isOriginAllowedByPolicy('https://attacker.vercel.app', { production: false, origins: [] })).toBe(false);
  });
});
