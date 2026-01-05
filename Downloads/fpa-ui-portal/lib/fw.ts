import { azure } from "@/lib/aoi";

export const insightsModel = azure(process.env.AZURE_OPENAI_DEPLOYMENT_NAME!);
