import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { Output, streamText } from 'ai';
import {
  GeneratedVariantsSchema,
  SingleVariantOutputSchema,
} from '@marketos/shared';
import { AssistantProviderOutputSchema } from '../assistant/assistant-output';

@Injectable()
export class OpenAiService {
  constructor(private readonly config: ConfigService) {}

  assistant(system: string, prompt: string, abortSignal: AbortSignal) {
    const openai = createOpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
    return streamText({
      model: openai(this.config.getOrThrow<string>('AI_MODEL')),
      system,
      prompt,
      output: Output.object({ schema: AssistantProviderOutputSchema }),
      maxOutputTokens: 8000,
      abortSignal,
    });
  }

  stream(
    system: string,
    prompt: string,
    abortSignal: AbortSignal,
    requestedOutputs: 1 | 3 = 3,
  ) {
    const openai = createOpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
    return streamText({
      model: openai(this.config.getOrThrow<string>('AI_MODEL')),
      system,
      prompt,
      output: Output.object({
        schema:
          requestedOutputs === 1
            ? SingleVariantOutputSchema
            : GeneratedVariantsSchema,
      }),
      maxOutputTokens: 12000,
      abortSignal,
    });
  }
}
