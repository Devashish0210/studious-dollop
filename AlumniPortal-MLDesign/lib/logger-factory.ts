import { cookies } from "next/headers";
import { SystemLogger, LangfuseLogger, FeedbackLogger } from "./logger-service";
import { randomUUID } from "crypto";

// Env Configuration
const APP_NAME = "llmApp";
const APP_ID = "AlumniPortalApp";
const ENV = "PROD";

/**
 * Helper to resolve UserID and SessionID.
 * Priority:
 * 1. Explicit arguments (overrides)
 * 2. Cookies (HttpOnly or Client accesible)
 * 3. Fallback to "unknown" (to satisfy Zod schema)
 */
async function resolveContext(overrides?: { userId?: string; sessionId?: string }) {
  let userId = overrides?.userId;
  let sessionId = overrides?.sessionId;

  // Try to get from cookies if not provided
  if (!userId || !sessionId) {
    const cookieStore = await cookies();

    
    const allCookies = cookieStore.getAll().map(c => c.name);
    // console.log(cookieStore.get("employee_login_state"));

    const loginCookie = cookieStore.get("employee_login_state")?.value;

    if (loginCookie) {
      try {
        const parsed = JSON.parse(loginCookie);
        userId = parsed.empID;
      } catch (e) {
        console.warn("Failed to parse employee_login_state", e);
      }
     }

    // Fallback
    if (!userId) {
       userId = cookieStore.get("empID")?.value || cookieStore.get("user_id")?.value;
    }
    
    if (!sessionId) {
      sessionId = randomUUID();
    }
  }

  return {
    userId: userId || "unknown",
    sessionId: sessionId || "unknown",
  };
}

/**
 * Factory for SystemLogger
 * Used for: Function execution, Errors, Performance metrics
 */
export async function getSystemLogger(overrides?: { userId?: string; sessionId?: string; tags?: string[] }) {
  const { userId, sessionId } = await resolveContext(overrides);
  const tags = overrides?.tags || [ENV];

  return new SystemLogger(APP_NAME, APP_ID, {
    userId,
    sessionId,
    tags,
  });
}

/**
 * Factory for LangfuseLogger
 * Used for: LLM Chat tracing (prompts, tokens, models)
 */
export async function getLangfuseLogger(overrides?: { userId?: string; sessionId?: string; tags?: string[] }) {
  const { userId, sessionId } = await resolveContext(overrides);
  const tags = overrides?.tags || ["chat", "llm", ENV];

  return new LangfuseLogger({
    appName: APP_NAME,
    appEnv: ENV,
    UserId: userId,
    SessionId: sessionId,
    Tags: tags,
  });
}

/**
 * Factory for FeedbackLogger
 * Used for: User ratings (Stars) and Message sentiment (Thumbs up/down)
 */
export async function getFeedbackLogger(overrides?: { userId?: string }) {
  // Feedback might not always have a session context, but needs a UserID
  const { userId } = await resolveContext(overrides);

  return new FeedbackLogger({
    appName: APP_NAME,
    appEnv: ENV,
    userId: userId,
  });
}