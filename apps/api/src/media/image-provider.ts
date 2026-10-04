import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateImage } from 'ai';
import type { GenerateImageInput } from '@marketos/shared';

@Injectable()
export class ImageProvider {
  constructor(private readonly config: ConfigService) {}

  async generate(
    model: string,
    prompt: string,
    size: GenerateImageInput['size'],
  ) {
    const openai = createOpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
    const result = await generateImage({
      model: openai.image(model),
      prompt,
      size,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(120_000),
    });
    return result.image.uint8Array;
  }
}
