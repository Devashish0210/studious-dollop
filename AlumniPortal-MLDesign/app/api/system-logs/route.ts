import { NextResponse } from "next/server";
import { getSystemLogger } from "@/lib/logger-factory";
import { z } from "zod";

// Schema for incoming client logs
const LogPayloadSchema = z.object({
  level: z.enum(["INFO", "ERROR", "DEFAULT"]),
  message: z.string(),
  source: z.string(),
  tags: z.array(z.string()).optional(),
  // Optional: Client can manually pass context if not using cookies
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Validate payload
    const data = LogPayloadSchema.parse(body);

    // Initialize logger. 
    // This will automatically resolve UserID/SessionID from cookies sent with this fetch request.
    const logger = await getSystemLogger({
      userId: data.userId,
      sessionId: data.sessionId,
      // We prepend 'client_proxy' to tags to distinguish these from server-side logs
      tags: data.tags ? ["client_proxy", ...data.tags] : ["client_proxy"],
    });

    // Dispatch to Azure Service Bus
    await logger.sendLogToServiceBus(data.message, data.level, data.source);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SystemLogProxy] Error processing log:", error);
    return NextResponse.json(
      { error: "Invalid log payload or internal error" }, 
      { status: 400 }
    );
  }
}