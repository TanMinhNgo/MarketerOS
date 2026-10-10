import { ConfigService } from '@nestjs/config';
import { ProviderError, ProviderGateway } from './provider.gateway';

const image = { bytes: new Uint8Array([1, 2, 3]), altText: 'Coffee cup' };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
afterEach(() => jest.restoreAllMocks());

test('Facebook uploads unpublished images in order and attaches them to one feed post', async () => {
  const fetcher = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({ id: 'photo1' }))
    .mockResolvedValueOnce(json({ id: 'photo2' }))
    .mockResolvedValueOnce(json({ id: 'post1' }));
  const result = await new ProviderGateway(new ConfigService()).publish(
    'FACEBOOK',
    'page',
    'token',
    'Caption',
    [image, image],
  );
  expect(result.id).toBe('post1');
  const upload = fetcher.mock.calls[0][1]?.body as FormData;
  expect(upload.get('published')).toBe('false');
  expect(upload.get('alt_text_custom')).toBe('Coffee cup');
  const body = fetcher.mock.calls[2][1]?.body as URLSearchParams;
  expect(body.get('message')).toBe('Caption');
  expect(body.get('attached_media[0]')).toBe(
    JSON.stringify({ media_fbid: 'photo1' }),
  );
  expect(body.get('attached_media[1]')).toBe(
    JSON.stringify({ media_fbid: 'photo2' }),
  );
});

test.each([1, 2])(
  'LinkedIn uploads %i images and sends the correct post shape',
  async (count) => {
    const fetcher = jest.spyOn(globalThis, 'fetch');
    for (let i = 0; i < count; i++) {
      fetcher.mockResolvedValueOnce(
        json({
          value: {
            uploadUrl: `https://www.linkedin.com/dms-uploads/${i}`,
            image: `urn:li:image:img${i}`,
          },
        }),
      );
      fetcher.mockResolvedValueOnce(new Response(null, { status: 201 }));
    }
    fetcher.mockResolvedValueOnce(
      new Response(null, {
        status: 201,
        headers: { 'x-restli-id': 'urn:li:share:post1' },
      }),
    );
    await new ProviderGateway(new ConfigService()).publish(
      'LINKEDIN',
      'member',
      'token',
      'Caption',
      Array.from({ length: count }, () => image),
    );
    const body = JSON.parse(fetcher.mock.calls.at(-1)![1]!.body as string) as {
      content: { media?: { id: string }; multiImage?: { images: unknown[] } };
    };
    expect(
      count === 1
        ? body.content.media?.id
        : body.content.multiImage?.images.length,
    ).toBe(count === 1 ? 'urn:li:image:img0' : 2);
    expect(fetcher.mock.calls[1][1]?.method).toBe('PUT');
    expect(fetcher.mock.calls[1][1]?.redirect).toBe('error');
  },
);

test.each([
  'http://www.linkedin.com/upload',
  'https://www.linkedin.com.evil.example/upload',
  'https://user:pass@www.linkedin.com/upload',
  'https://127.0.0.1/upload',
])(
  'rejects untrusted upload URL %s before sending credentials',
  async (uploadUrl) => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        json({ value: { uploadUrl, image: 'urn:li:image:img0' } }),
      );
    await expect(
      new ProviderGateway(new ConfigService()).publish(
        'LINKEDIN',
        'member',
        'token',
        'Caption',
        [image],
      ),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

test('malformed Facebook upload response never becomes a text-only post', async () => {
  const fetcher = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({ id: null }));
  await expect(
    new ProviderGateway(new ConfigService()).publish(
      'FACEBOOK',
      'page',
      'token',
      'Caption',
      [image],
    ),
  ).rejects.toMatchObject({ ambiguous: true });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('a lost final post response is ambiguous and never retryable', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(json({ id: 'photo1' }))
    .mockRejectedValueOnce(new Error('timeout'));
  await expect(
    new ProviderGateway(new ConfigService()).publish(
      'FACEBOOK',
      'page',
      'token',
      'Caption',
      [image],
    ),
  ).rejects.toMatchObject({ ambiguous: true, retryable: false });
});
