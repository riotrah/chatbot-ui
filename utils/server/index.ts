import { Message } from '@/types/chat';
import { OpenAIModel, OpenAIModelFamily } from '@/types/openai';

import {
  AZURE_DEPLOYMENT_ID,
  AZURE_DEPLOYMENT_ID_3,
  AZURE_DEPLOYMENT_ID_4,
  OPENAI_API_HOST,
  OPENAI_API_HOST_3,
  OPENAI_API_HOST_4,
  OPENAI_API_TYPE,
  OPENAI_API_VERSION,
  OPENAI_ORGANIZATION,
} from '../app/const';

import {
  ParsedEvent,
  ReconnectInterval,
  createParser,
} from 'eventsource-parser';

export class OpenAIError extends Error {
  type: string;
  param: string;
  code: string;

  constructor(message: string, type: string, param: string, code: string) {
    super(message);
    this.name = 'OpenAIError';
    this.type = type;
    this.param = param;
    this.code = code;
  }
}

export const OpenAIStream = async (
  model: OpenAIModel,
  systemPrompt: string,
  temperature: number,
  key: string | undefined,
  messages: Message[],
) => {
  let url = `${OPENAI_API_HOST}/v1/chat/completions`;
  const modelFamily = model.family ?? OpenAIModelFamily.GPT_3;

  if (OPENAI_API_TYPE === 'azure') {
    const host =
      (modelFamily === OpenAIModelFamily.GPT_3
        ? OPENAI_API_HOST_3
        : OPENAI_API_HOST_4) ?? OPENAI_API_HOST;
    const deploymentId =
      (modelFamily === OpenAIModelFamily.GPT_3
        ? AZURE_DEPLOYMENT_ID_3
        : AZURE_DEPLOYMENT_ID_4) ?? AZURE_DEPLOYMENT_ID;
    url = `${host}/openai/deployments/${deploymentId}/chat/completions?api-version=${OPENAI_API_VERSION}`;
  }

  const azureKey =
    OPENAI_API_TYPE === 'azure'
      ? modelFamily === OpenAIModelFamily.GPT_3
        ? process.env.OPENAI_API_KEY_3
        : process.env.OPENAI_API_KEY_4
      : undefined;
  key = key || azureKey || process.env.OPENAI_API_KEY;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(OPENAI_API_TYPE === 'openai' && {
        Authorization: `Bearer ${key}`,
      }),
      ...(OPENAI_API_TYPE === 'azure' && {
        'api-key': `${key}`,
      }),
      ...(OPENAI_API_TYPE === 'openai' &&
        OPENAI_ORGANIZATION && {
          'OpenAI-Organization': OPENAI_ORGANIZATION,
        }),
    },
    method: 'POST',
    body: JSON.stringify({
      ...(OPENAI_API_TYPE === 'openai' && { model: model.id }),
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ],
      max_tokens: 1000,
      temperature: temperature,
      stream: true,
    }),
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  if (res.status !== 200) {
    const result = await res.json();
    if (result.error) {
      throw new OpenAIError(
        result.error.message,
        result.error.type,
        result.error.param,
        result.error.code,
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`,
      );
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data;
          // https://github.com/mckaywrigley/chatbot-ui/issues/580#issuecomment-1523023238
          // Check for [DONE] to fix #580
          if (data !== '[DONE]') {
            try {
              const json = JSON.parse(data);
              if (json.choices[0].finish_reason != null) {
                controller.close();
                return;
              }
              const text = json.choices[0].delta.content;
              const queue = encoder.encode(text);
              controller.enqueue(queue);
            } catch (e) {
              controller.error(e);
            }
          }
        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};
