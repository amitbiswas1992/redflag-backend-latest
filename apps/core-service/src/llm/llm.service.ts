import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { z, ZodType } from 'zod';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiUrl = process.env.LLM_API_URL ?? 'https://openrouter.ai/api/v1/chat/completions';
    this.apiKey = process.env.LLM_API_KEY ?? '';
    this.model = process.env.LLM_MODEL ?? 'openai/gpt-4o';
  }

  async ask<T extends ZodType>(messages: LlmMessage[], schema: T): Promise<z.infer<T>> {
    const jsonSchema = z.toJSONSchema(schema);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'response',
            strict: true,
            schema: jsonSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`LLM API error [${response.status}]: ${error}`);
      throw new InternalServerErrorException('LLM request failed');
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0].message.content;
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;

    return schema.parse(parsed) as z.infer<T>;
  }
}
