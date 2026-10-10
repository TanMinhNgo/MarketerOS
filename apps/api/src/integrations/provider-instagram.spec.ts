import { ConfigService } from '@nestjs/config';
import { ProviderError, ProviderGateway } from './provider.gateway';

const json = (body: unknown) => new Response(JSON.stringify(body));
afterEach(() => jest.restoreAllMocks());
test('catalog configuration requires provider credentials, callback and encryption key', () => {
  const config = new ConfigService({
    INSTAGRAM_APP_ID: 'ig-app',
    INSTAGRAM_APP_SECRET: 'ig-secret',
    OAUTH_CALLBACK_BASE: 'https://api.example',
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  });
  const gateway = new ProviderGateway(config);
  expect(gateway.configured('instagram')).toBe(true);
  expect(gateway.configured('facebook')).toBe(false);
  expect(gateway.configured('linkedin')).toBe(false);
  const url = new URL(gateway.authorize('instagram', 'state'));
  expect(url.hostname).toBe('www.facebook.com');
  expect(url.searchParams.get('client_id')).toBe('ig-app');
  expect(url.searchParams.get('redirect_uri')).toBe(
    'https://api.example/api/oauth/instagram/callback',
  );
  expect(url.searchParams.get('scope')).toContain('instagram_content_publish');
  config.set('TOKEN_ENCRYPTION_KEY', 'bad');
  expect(gateway.configured('instagram')).toBe(false);
});
test('Instagram exchanges its own app credentials and only lists linked professional accounts', async () => {
  const fetcher = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      json({ access_token: 'user-token', expires_in: 3600 }),
    )
    .mockResolvedValueOnce(
      json({
        data: [
          {
            id: 'page1',
            name: 'Page',
            access_token: 'page-token',
            instagram_business_account: {
              id: 'ig1',
              username: 'coffee',
              profile_picture_url: 'https://example.com/avatar',
            },
          },
          { id: 'page2', name: 'No Instagram', access_token: 'other-token' },
        ],
      }),
    );
  const gateway = new ProviderGateway(
    new ConfigService({
      INSTAGRAM_APP_ID: 'ig-app',
      INSTAGRAM_APP_SECRET: 'ig-secret',
      OAUTH_CALLBACK_BASE: 'https://api.example',
    }),
  );
  await gateway.exchange('instagram', 'code');
  const request = new URL(fetcher.mock.calls[0][0]);
  expect(request.searchParams.get('client_id')).toBe('ig-app');
  expect(request.searchParams.get('redirect_uri')).toContain(
    '/instagram/callback',
  );
  expect(await gateway.facebookPages('user-token', true)).toEqual([
    {
      id: 'ig1',
      name: 'coffee',
      avatarUrl: 'https://example.com/avatar',
      accessToken: 'page-token',
    },
  ]);
});
test.each([1, 2])(
  'Instagram publishes %i images only after containers are ready',
  async (count) => {
    const fetcher = jest.spyOn(globalThis, 'fetch');
    for (let i = 0; i < count; i++)
      fetcher
        .mockResolvedValueOnce(json({ id: `child${i}` }))
        .mockResolvedValueOnce(json({ status_code: 'FINISHED' }));
    if (count > 1)
      fetcher
        .mockResolvedValueOnce(json({ id: 'carousel' }))
        .mockResolvedValueOnce(json({ status_code: 'FINISHED' }));
    fetcher
      .mockResolvedValueOnce(json({ id: 'igpost' }))
      .mockResolvedValueOnce(
        json({ permalink: 'https://www.instagram.com/p/post/' }),
      );
    const result = await new ProviderGateway(new ConfigService()).publish(
      'INSTAGRAM',
      'account',
      'token',
      'Caption',
      [],
      Array.from(
        { length: count },
        (_, i) => `https://ik.example/image${i}.jpg?signed=yes`,
      ),
    );
    expect(result).toEqual({
      id: 'igpost',
      url: 'https://www.instagram.com/p/post/',
    });
    const publishCall = fetcher.mock.calls.find(
      (call) =>
        typeof call[0] === 'string' && call[0].endsWith('/media_publish'),
    )!;
    expect((publishCall[1]?.body as URLSearchParams).get('creation_id')).toBe(
      count === 1 ? 'child0' : 'carousel',
    );
    if (count > 1) {
      const parent = fetcher.mock.calls.find(
        (call) =>
          (call[1]?.body as URLSearchParams | undefined)?.get?.(
            'media_type',
          ) === 'CAROUSEL',
      )!;
      expect((parent[1]?.body as URLSearchParams).get('children')).toBe(
        'child0,child1',
      );
    }
  },
);
test('Instagram rejects failed processing without attempting publication', async () => {
  const fetcher = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({ id: 'container' }))
    .mockResolvedValueOnce(json({ status_code: 'ERROR' }));
  await expect(
    new ProviderGateway(new ConfigService()).publish(
      'INSTAGRAM',
      'account',
      'token',
      'Caption',
      [],
      ['https://ik.example/image.jpg'],
    ),
  ).rejects.toMatchObject({ code: 'CONTENT_REJECTED' });
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('Instagram stops polling unfinished containers and never publishes them', async () => {
  jest.useFakeTimers();
  const fetcher = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({ id: 'container' }))
    .mockImplementation(() =>
      Promise.resolve(json({ status_code: 'IN_PROGRESS' })),
    );
  try {
    const assertion = expect(
      new ProviderGateway(new ConfigService()).publish(
        'INSTAGRAM',
        'account',
        'token',
        'Caption',
        [],
        ['https://ik.example/image.jpg'],
      ),
    ).rejects.toMatchObject({ code: 'CONTENT_REJECTED' });
    await jest.runAllTimersAsync();
    await assertion;
    expect(fetcher).toHaveBeenCalledTimes(11);
    expect(
      fetcher.mock.calls.every(
        (call) =>
          typeof call[0] === 'string' && !call[0].endsWith('/media_publish'),
      ),
    ).toBe(true);
  } finally {
    jest.useRealTimers();
  }
});
test('Instagram does not downgrade a confirmed publication when permalink lookup fails', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({ id: 'container' }))
    .mockResolvedValueOnce(json({ status_code: 'FINISHED' }))
    .mockResolvedValueOnce(json({ id: 'posted' }))
    .mockRejectedValueOnce(new Error('offline'));
  expect(
    await new ProviderGateway(new ConfigService()).publish(
      'INSTAGRAM',
      'account',
      'token',
      'Caption',
      [],
      ['https://ik.example/image.jpg'],
    ),
  ).toEqual({ id: 'posted', url: null });
});
test('an ambiguous final Instagram publish request is never retryable', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({ id: 'container' }))
    .mockResolvedValueOnce(json({ status_code: 'FINISHED' }))
    .mockRejectedValueOnce(new Error('timeout'));
  await expect(
    new ProviderGateway(new ConfigService()).publish(
      'INSTAGRAM',
      'account',
      'token',
      'Caption',
      [],
      ['https://ik.example/image.jpg'],
    ),
  ).rejects.toMatchObject({ ambiguous: true, retryable: false });
});

test('Instagram does not start another side effect after its processing budget expires', async () => {
  const fetcher = jest.spyOn(globalThis, 'fetch');
  jest.spyOn(Date, 'now').mockReturnValueOnce(0).mockReturnValue(180_000);
  await expect(
    new ProviderGateway(new ConfigService()).publish(
      'INSTAGRAM',
      'account',
      'token',
      'Caption',
      [],
      ['https://ik.example/image.jpg'],
    ),
  ).rejects.toMatchObject({ code: 'CONTENT_REJECTED' });
  expect(fetcher).not.toHaveBeenCalled();
});
test.each([{ urls: [] }, { urls: ['http://localhost/image.jpg'] }])(
  'Instagram rejects unavailable media',
  async ({ urls }) => {
    const fetcher = jest.spyOn(globalThis, 'fetch');
    await expect(
      new ProviderGateway(new ConfigService()).publish(
        'INSTAGRAM',
        'account',
        'token',
        'Caption',
        [],
        urls,
      ),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(fetcher).not.toHaveBeenCalled();
  },
);
