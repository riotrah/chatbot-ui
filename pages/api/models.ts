import {
  OPENAI_API_HOST,
  OPENAI_API_HOST_3,
  OPENAI_API_HOST_4,
  OPENAI_API_TYPE,
  OPENAI_API_VERSION,
  OPENAI_ORGANIZATION,
} from '@/utils/app/const';

import { OpenAIModel, OpenAIModelID, OpenAIModels } from '@/types/openai';

export const config = {
  runtime: 'edge',
};

const handler = async (req: Request): Promise<Response> => {
  try {
    const { key } = (await req.json()) as {
      key: string;
    };

    let configs = [
      {
        url: `${OPENAI_API_HOST}/v1/models`,
        key: key || process.env.OPENAI_API_KEY,
      },
    ];

    if (OPENAI_API_TYPE === 'azure') {
      configs = [
        {
          url: `${OPENAI_API_HOST_3}/openai/deployments?api-version=${OPENAI_API_VERSION}`,
          key: key || process.env.OPENAI_API_KEY_3,
        },
        {
          url: `${OPENAI_API_HOST_4}/openai/deployments?api-version=${OPENAI_API_VERSION}`,
          key: key || process.env.OPENAI_API_KEY_4,
        },
      ];
    }

    const models: OpenAIModel[] = [];

    for (const config of configs) {
      const { url, key } = config;
      const response = await fetch(url, {
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
      });

      if (response.status === 401) {
        return new Response(response.body, {
          status: 500,
          headers: response.headers,
        });
      } else if (response.status !== 200) {
        console.error(
          `OpenAI API returned an error ${
            response.status
          }: ${await response.text()}`,
        );
        throw new Error('OpenAI API returned an error');
      }

      const json = await response.json();
      (json.data as any[]).forEach((model: any) => {
        const model_name = OPENAI_API_TYPE === 'azure' ? model.model : model.id;
        for (const [enumId, name] of Object.entries(OpenAIModelID)) {
          if (name === model_name) {
            models.push({
              id: model.id,
              name: OpenAIModels[name].name,
              family: OpenAIModels[name].family,
              maxLength: OpenAIModels[name].maxLength,
              tokenLimit: OpenAIModels[name].tokenLimit,
            });
          }
        }
      });
    }

    return new Response(JSON.stringify(models), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('Error', { status: 500 });
  }
};

export default handler;
