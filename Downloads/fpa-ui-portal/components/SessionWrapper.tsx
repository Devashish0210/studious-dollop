"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

// This component wraps the application with the NextAuth SessionProvider
export default function SessionWrapper({ children }: { children: ReactNode }) {
  return <SessionProvider basePath="/copilot/fpa-chat/api/auth">{children}</SessionProvider>;
}
