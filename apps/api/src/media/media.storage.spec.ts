import { ConfigService } from '@nestjs/config';
import ImageKit from '@imagekit/nodejs';
import { MediaStorage } from './media.storage';

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
  await storage.remove(fileId);
  expect(client.files.delete).toHaveBeenCalledWith('file-123');
});
