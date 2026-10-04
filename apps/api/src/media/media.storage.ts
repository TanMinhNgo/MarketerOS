import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ImageKit, { toFile } from '@imagekit/nodejs';
import { randomUUID } from 'node:crypto';

@Injectable()
export class MediaStorage {
  private client?: ImageKit;
  constructor(private readonly config: ConfigService) {}

  private settings() {
    const privateKey = this.config.get<string>('IMAGEKIT_PRIVATE_KEY');
    const urlEndpoint = this.config.get<string>('IMAGEKIT_URL_ENDPOINT');
    if (!privateKey || !urlEndpoint)
      throw new ServiceUnavailableException('ImageKit is not configured');
    this.client ??= new ImageKit({ privateKey });
    return { client: this.client, urlEndpoint };
  }

  async put(projectId: string, bytes: Uint8Array, mimeType: string) {
    const { client } = this.settings();
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.slice(6);
    const fileName = `${randomUUID()}.${extension}`;
    const response = await client.files.upload({
      file: await toFile(bytes, fileName),
      fileName,
      folder: `/marketos/projects/${projectId}/assets`,
      isPrivateFile: true,
      useUniqueFileName: false,
      overwriteFile: false,
    });
    if (!response.fileId)
      throw new ServiceUnavailableException(
        'ImageKit did not return a file ID',
      );
    return response.fileId;
  }

  async remove(fileId: string) {
    const { client } = this.settings();
    try {
      await client.files.delete(fileId);
    } catch (error) {
      // Deletion is idempotent: a previous worker attempt may have deleted the file.
      if (error instanceof ImageKit.APIError && error.status === 404) return;
      throw error;
    }
  }

  async url(fileId: string) {
    const { client, urlEndpoint } = this.settings();
    const file = await client.files.get(fileId);
    if (!file.filePath)
      throw new ServiceUnavailableException(
        'ImageKit did not return a file path',
      );
    const expiresIn = 300;
    const url = client.helper.buildSrc({
      urlEndpoint,
      src: file.filePath,
      signed: true,
      expiresIn,
    });
    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }
}
