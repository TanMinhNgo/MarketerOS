import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { Output, streamText } from 'ai';
import { GeneratedVariantsSchema } from '@marketos/shared';

@Injectable()
export class OpenAiService {
  constructor(private readonly config: ConfigService) {}

  stream(system: string, prompt: string, abortSignal: AbortSignal) {
    const openai = createOpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
    return streamText({
      model: openai(this.config.getOrThrow<string>('AI_MODEL')),
      system,
      prompt,
      output: Output.object({ schema: GeneratedVariantsSchema }),
      maxOutputTokens: 12000,
      abortSignal,
    });
  }
}
