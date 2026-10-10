import { describe, expect, it, vi } from 'vitest';
import { INTEGRATION_PROVIDERS } from '@marketos/shared';
vi.mock('./api-client', () => ({ api: vi.fn(), request: vi.fn() }));
vi.mock('./queries', () => ({ keys: {}, useUsage: vi.fn() }));
import { visibleConnectionProviders, isPublishable, type Connection } from './integrations-api';

describe('configured connections', () => {
  const providers = INTEGRATION_PROVIDERS.map(p => ({ ...p, configured: p.provider === 'instagram' }));
  it('only shows configured providers and includes Instagram publishing', () => {
    expect(visibleConnectionProviders(providers, []).map(p => p.provider)).toEqual(['instagram']);
    expect(isPublishable('INSTAGRAM')).toBe(true);
    for (const channel of ['TIKTOK','YOUTUBE','EMAIL','BLOG']) expect(isPublishable(channel)).toBe(false);
  });
  it('keeps an existing connection manageable after provider credentials are removed', () => {
    const connections = [{ channel: 'FACEBOOK' }] as Connection[];
    expect(visibleConnectionProviders(providers, connections).map(p => p.provider)).toEqual(['facebook','instagram']);
  });
});
