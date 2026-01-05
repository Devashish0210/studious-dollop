import { createAzure } from "@ai-sdk/azure";

export const azure = createAzure({
  resourceName: "aicoe-dalle3",
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
});
