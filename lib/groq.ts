import Groq from 'groq-sdk';

let groqInstance: Groq | null = null;

export function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY || '';
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured in environment variables.');
  }

  if (!groqInstance) {
    groqInstance = new Groq({ apiKey });
  }

  return groqInstance;
}

export interface GroqChatOptions {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Executes a chat completion with Groq with exponential backoff on 429/5xx errors.
 */
export async function generateGroqCompletion(options: GroqChatOptions): Promise<string> {
  const groq = getGroqClient();
  const model = options.model || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // First attempt with JSON mode
      const completion = await groq.chat.completions.create({
        model,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Groq returned empty response content.');
      }
      return content;
    } catch (err: any) {
      const status = err?.status || err?.statusCode;
      const errorMsg = err?.message || '';

      // If Groq rejects response_format (json_validate_failed), retry without response_format
      if (errorMsg.includes('json_validate_failed') || errorMsg.includes('Failed to validate JSON') || status === 400) {
        try {
          const fallback = await groq.chat.completions.create({
            model,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 2500,
            messages: [
              { role: 'system', content: options.systemPrompt },
              { role: 'user', content: options.userPrompt },
            ],
          });
          const content = fallback.choices[0]?.message?.content;
          if (content) return content;
        } catch (fallbackErr: any) {
          // If fallback fails with rate limit, continue loop
          err = fallbackErr;
        }
      }

      const isRateOrServerError = status === 429 || (status >= 500 && status < 600);

      if (attempt < maxRetries && isRateOrServerError) {
        let delay = Math.pow(2, attempt + 1) * 1000;
        const retryAfter = err?.headers?.['retry-after'];
        if (retryAfter && !isNaN(Number(retryAfter))) {
          delay = Number(retryAfter) * 1000;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw err;
    }
  }

  throw new Error('Groq generation failed after retries.');
}

/**
 * Tests Groq API connectivity and returns status.
 */
export async function testGroqConnection(customModel?: string): Promise<{ success: boolean; model: string; message: string }> {
  try {
    const groq = getGroqClient();
    const model = customModel || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

    const response = await groq.chat.completions.create({
      model,
      max_tokens: 500,
      messages: [{ role: 'user', content: 'Say OK' }],
    });

    return {
      success: true,
      model,
      message: response.choices[0]?.message?.content?.trim() || 'Connection successful',
    };
  } catch (err: any) {
    return {
      success: false,
      model: customModel || 'openai/gpt-oss-120b',
      message: err?.message || 'Failed to connect to Groq API',
    };
  }
}
