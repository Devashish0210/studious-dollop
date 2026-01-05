import AzureADProvider from "next-auth/providers/azure-ad";
import type { NextAuthOptions, SessionStrategy } from "next-auth";
import type { JWT } from "next-auth/jwt";
import axios from "axios";

// --- Types ---
export type UserRole = "ADMIN" | "USER" | "GUEST";

// --- User Request Payload ---
interface UserRequestPayload {
  email?: string;
  email_verified?: boolean;
  name?: string;
  nickname?: string;
  picture?: string;
  sub?: string;
  updated_at?: string;
  id?: string;
  role?: UserRole;
  created_at?: string;
}

// --- Login Response ---
interface LoginResponse {
  email: string;
  role: UserRole;
  id: string;
  name?: string;
  picture?: string;
}

// --- API Call to DataHerald ---
async function getUserRoleFromLoginAPI(
  user: UserRequestPayload,
  accessToken: string
): Promise<UserRole> {
  if (!user.email || !accessToken) {
    console.warn("Missing email or access token for role fetch");
    return "USER";
  }

  try {
    const response = await axios.post<LoginResponse>(
      `http://localhost:3491/auth/login`,
      user,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response?.data?.role ? response.data.role : "USER";
  } catch (error: any) {
    console.error("Error fetching user role from login API:", error.message);
    return "USER";
  }
}

// --- NextAuth Config ---
export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope: "openid profile email User.Read offline_access",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    // --- JWT Callback ---
    async jwt({ token, account }: { token: JWT; account: any }) {
      // First-time sign in
      if (account?.access_token) {
        try {
          const graphRes = await fetch("https://graph.microsoft.com/v1.0/me", {
            headers: { Authorization: `Bearer ${account.access_token}` },
          });

          const profile = await graphRes.json();

          const userPayload: UserRequestPayload = {
            email: profile.mail,
            name: profile.displayName,
            sub: profile.id,
            picture: profile.userPrincipalName,
            updated_at: new Date().toISOString(),
          };

          const role = await getUserRoleFromLoginAPI(
            userPayload,
            account.access_token
          );

          return {
            accessToken: account.access_token,
            exp:
              (account.expires_at ?? Math.floor(Date.now() / 1000) + 3600) *
              1000,
            rt: account.refresh_token,
            r: role,
            e: profile.mail,
            n: profile.displayName,
            sub: profile.id,
          };
        } catch (error: any) {
          console.error("Error in JWT creation:", error.message);
          return { error: "TokenError" };
        }
      }

      // Refresh token if expired
      if (typeof token.exp === "number" && Date.now() >= token.exp) {
        try {
          const refreshToken = token.rt as string | undefined;
          if (!refreshToken) throw new Error("Missing refresh token");

          const url = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

          const response = await fetch(url, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            method: "POST",
            body: new URLSearchParams({
              client_id: process.env.AZURE_AD_CLIENT_ID!,
              client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
              grant_type: "refresh_token",
              refresh_token: refreshToken,
            }),
          });

          const refreshedTokens = await response.json();

          if (!response.ok) throw refreshedTokens;

          return {
            ...token,
            exp: Date.now() + refreshedTokens.expires_in * 1000,
            rt: refreshedTokens.refresh_token ?? refreshToken,
            accessToken: refreshedTokens.access_token,
          };
        } catch (error: any) {
          console.error("Token refresh error:", error.message);
          return { ...token, error: "RefreshError" };
        }
      }

      return token;
    },

    // --- Session Callback ---
    async session({ session, token }: { session: any; token: JWT }) {
      return {
        ...session,
        user: {
          id: token.sub as string,
          name: (token.n as string) ?? null,
          email: (token.e as string) ?? null,
          role: (token.r as string) ?? "USER",
          accessToken: token?.accessToken,
        },
        error: token.error ?? null,
      };
    },

    // --- Redirect Logic ---
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      return url.startsWith("/") ? `${baseUrl}${basePath}${url}` : url;
    },
  },

  session: {
    strategy: "jwt" as SessionStrategy,
    maxAge: 12 * 60 * 60, // 12 hours
  },
};
 