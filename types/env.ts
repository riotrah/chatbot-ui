export interface ProcessEnv {
  OPENAI_API_KEY: string;
  OPENAI_API_KEY_3: string;
  OPENAI_API_KEY_4: string;
  OPENAI_API_HOST?: string;
  OPENAI_API_HOST_3?: string;
  OPENAI_API_HOST_4?: string;
  OPENAI_API_TYPE?: 'openai' | 'azure';
  OPENAI_API_VERSION?: string;
  OPENAI_ORGANIZATION?: string;
  AZURE_DEPLOYMENT_ID_3?: string;
  AZURE_DEPLOYMENT_ID_4?: string;
}
