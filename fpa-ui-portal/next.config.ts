import type { NextConfig } from "next";
 
const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH,
  env: {
    API_ENGINE_URL: process.env.API_ENGINE_URL,
    API_AUTH_KEY: process.env.API_AUTH_KEY,
    AZURE_OPENAI_API_BASE: process.env.AZURE_OPENAI_API_BASE,
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
    AZURE_LLM_NAME: process.env.AZURE_LLM_NAME,
    AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    AZURE_DB_CONNECTION_ID: process.env.AZURE_DB_CONNECTION_ID,
    AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION,
 
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID!,
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET!,
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID!,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  },
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/_next/:path*",
        destination: "/_next/:path*",
      },
    ];
  },
  async headers() {
    return [
   
    ];
  },
};
 
export default nextConfig;