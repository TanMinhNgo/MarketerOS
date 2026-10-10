import { ConfigService } from '@nestjs/config';
import ImageKit from '@imagekit/nodejs';
import { MediaStorage } from './media.storage';
import sharp from 'sharp';

test('publication reads reject non-byte stream data', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue('invalid' as unknown as Uint8Array);
          controller.close();
        },
      }),
    ),
  );
  const storage = new MediaStorage(new ConfigService());
  jest.spyOn(storage, 'url').mockResolvedValue({
    url: 'https://ik.example/signed',
    expiresAt: new Date().toISOString(),
  });
  try {
    await expect(storage.publicationImage('file')).rejects.toThrow(
      'Invalid publication image stream',
    );
  } finally {
    jest.restoreAllMocks();
  }
});

test('publication images use a signed read, reject redirects and convert WebP to PNG', async () => {
  const bytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: 'red' },
  })
    .webp()
    .toBuffer();
  const fetcher = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(new Uint8Array(bytes)));
  const storage = new MediaStorage(new ConfigService());
  jest.spyOn(storage, 'url').mockResolvedValue({
    url: 'https://ik.example/signed',
    expiresAt: new Date().toISOString(),
  });
  try {
    expect(
      (await sharp(await storage.publicationImage('file')).metadata()).format,
    ).toBe('png');
    expect(fetcher).toHaveBeenCalledWith(
      'https://ik.example/signed',
      expect.objectContaining({ redirect: 'error' }),
    );
  } finally {
    jest.restoreAllMocks();
  }
});

test('publication reads enforce the limit even without content-length', async () => {
  const fetcher = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(new Uint8Array(10 * 1024 * 1024 + 1)));
  const storage = new MediaStorage(new ConfigService());
  jest.spyOn(storage, 'url').mockResolvedValue({
    url: 'https://ik.example/signed',
    expiresAt: new Date().toISOString(),
  });
  try {
    await expect(storage.publicationImage('file')).rejects.toThrow('too large');
  } finally {
    fetcher.mockRestore();
    jest.restoreAllMocks();
  }
});

test('ImageKit storage uploads private files, signs reads and deletes by file ID', async () => {
  const client = {
    files: {
      upload: jest.fn().mockResolvedValue({ fileId: 'file-123' }),
      get: jest.fn().mockResolvedValue({ filePath: '/marketos/p/image.png' }),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    helper: {
      buildSrc: jest.fn().mockReturnValue('https://ik.example/signed'),
    },
  };
  const config = {
    get: (name: string) =>
      name === 'IMAGEKIT_PRIVATE_KEY'
        ? 'private-key'
        : 'https://ik.imagekit.io/example',
  };
  const storage = new MediaStorage(config as ConfigService);
  Reflect.set(storage, 'client', client as unknown as ImageKit);

  const fileId = await storage.put('p', new Uint8Array([1, 2, 3]), 'image/png');
  expect(fileId).toBe('file-123');
  expect(client.files.upload).toHaveBeenCalledWith(
    expect.objectContaining({
      folder: '/marketos/projects/p/assets',
      isPrivateFile: true,
      useUniqueFileName: false,
      overwriteFile: false,
    }),
  );
  const signed = await storage.url(fileId);
  expect(client.files.get).toHaveBeenCalledWith('file-123');
  expect(client.helper.buildSrc).toHaveBeenCalledWith({
    urlEndpoint: 'https://ik.imagekit.io/example',
    src: '/marketos/p/image.png',
    signed: true,
    expiresIn: 300,
  });
  expect(signed.url).toBe('https://ik.example/signed');
  await storage.instagramImageUrl(fileId);
  expect(client.helper.buildSrc).toHaveBeenLastCalledWith(
    expect.objectContaining({
      signed: true,
      expiresIn: 900,
      transformation: [
        {
          format: 'jpg',
          width: 1080,
          height: 1080,
          cropMode: 'pad_resize',
          quality: 85,
        },
      ],
    }),
  );
  await storage.remove(fileId);
  expect(client.files.delete).toHaveBeenCalledWith('file-123');
});
