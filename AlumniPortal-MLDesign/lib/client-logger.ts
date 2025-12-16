/**
 * Client-Side Logger Utility
 * * This utility forwards logs from the Browser (Client Components) to the 
 * Server-Side Log Proxy (/api/system-logs), which then pushes them to Azure Service Bus.
 */

type ClientLogLevel = "INFO" | "ERROR" | "DEFAULT";

interface ClientLogPayload {
  level: ClientLogLevel;
  message: string;
  source: string;
  tags?: string[];
  userId?: string;
  sessionId?: string;
}

export const clientLogger = {
  /**
   * Internal method to send payload to the proxy API
   */
  async send(payload: ClientLogPayload) {
    // Avoid infinite loops if logging fails
    try {
      // "Fire and forget" - we don't await the result to block the UI
      fetch("/api/system-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch((err) => {
        console.warn("[ClientLogger] Failed to transport log to server:", err);
      });
    } catch (e) {
      console.warn("[ClientLogger] Critical error in logger:", e);
    }
  },

  info(message: string, source: string, tags: string[] = []) {
    this.send({ level: "INFO", message, source, tags });
  },

  /**
   * Logs an error with optional exception details
   */
  error(message: string, source: string, error?: unknown, tags: string[] = []) {
    let errorDetails = "";
    
    if (error instanceof Error) {
      errorDetails = ` | Exception: ${error.message} | Stack: ${error.stack}`;
    } else if (error) {
      errorDetails = ` | Exception: ${String(error)}`;
    }

    this.send({ 
      level: "ERROR", 
      message: message + errorDetails, 
      source, 
      tags: ["error", ...tags] 
    });
  }
};