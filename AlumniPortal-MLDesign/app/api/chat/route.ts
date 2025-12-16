import { streamText } from "ai";
import { createTools } from "../../../lib/tools";
import { azure } from "../../../lib/aoi";
import { getGeographyPrompt } from "../../../lib/prompt";
import getSystemPrompt from '../../../lib/simplified-prompt';
import { getLangfuseLogger, getSystemLogger } from "@/lib/logger-factory"; 

export const maxDuration = 30;

// Helper to sanitize strings
// 1. Removes backticks
// 2. Replaces single quotes with double quotes
// 3. Removes NEWLINES (Critical Fix)
function cleanString(str: any): string {
  if (!str) return "";
  return String(str)
    .replace(/`/g, '"')   // Remove backticks
    .replace(/'/g, '"')   // Standardize quotes
    .replace(/\n/g, " ")  // Remove newlines (Flatten the string)
    .trim();
}

// ============== ERROR HANDLING UTILITIES ==============

function categorizeError(error: any): { 
  userMessage: string; 
  shouldRedirect: boolean;
  errorType: string;
} {
  // Azure Content Filter / Guardrails
  if (
    error?.message?.toLowerCase().includes('content') ||
    error?.message?.toLowerCase().includes('filter') ||
    error?.message?.toLowerCase().includes('responsible ai') ||
    error?.code === 'content_filter' ||
    error?.status === 400
  ) {
    console.error('❌ [CONTENT_FILTER] Request blocked by Azure content safety:', {
      message: error?.message,
      code: error?.code,
      status: error?.status
    });
    
    return {
      userMessage: "I can't help with that request. Please ask me about HR policies, documents, or support tickets.",
      shouldRedirect: false,
      errorType: 'CONTENT_FILTER'
    };
  }
  
  // Authentication Errors (403)
  if (error?.status === 403 || error?.message?.toLowerCase().includes('auth')) {
    console.error('❌ [AUTH_ERROR] Authentication failed:', {
      message: error?.message,
      status: error?.status
    });
    
    return {
      userMessage: "Your session has expired. Redirecting to login...",
      shouldRedirect: true,
      errorType: 'AUTH_ERROR'
    };
  }
  
  // Network / Connectivity Issues
  if (
    error?.message?.toLowerCase().includes('network') ||
    error?.message?.toLowerCase().includes('timeout') ||
    error?.message?.toLowerCase().includes('fetch') ||
    error?.code === 'ECONNREFUSED' ||
    error?.code === 'ETIMEDOUT'
  ) {
    console.error('❌ [NETWORK_ERROR] Connectivity issue:', {
      message: error?.message,
      code: error?.code
    });
    
    return {
      userMessage: "I'm experiencing connectivity issues. Please check your internet connection and try again.",
      shouldRedirect: false,
      errorType: 'NETWORK_ERROR'
    };
  }
  
  // Generic/Unknown Errors
  console.error('❌ [UNKNOWN_ERROR] Unhandled error:', error);
  
  return {
    userMessage: "I encountered an unexpected error. Please try again or contact HR for assistance.",
    shouldRedirect: false,
    errorType: 'UNKNOWN_ERROR'
  };
}

function createErrorStream(userMessage: string, shouldRedirect: boolean, errorType: string): Response {
  const errorStream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      
      const messageData = {
        role: 'assistant',
        content: userMessage
      };
      
      const chunk = `0:${JSON.stringify(userMessage)}\n`;
      controller.enqueue(encoder.encode(chunk));
      
      // Add finish reason
      controller.enqueue(encoder.encode(`d:{"finishReason":"stop"}\n`));
      
      controller.close();
    }
  });
  
  return new Response(errorStream, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Error-Occurred': 'true',
      'X-Error-Type': errorType,
      'X-Should-Redirect': shouldRedirect ? 'true' : 'false'
    }
  });
}

// ============== MAIN POST HANDLER ==============
export async function POST(req: Request) {
  const requestStartTime = Date.now();
  let requestId = "";
  let sessionId = "";
  let systemPrompt = "";
  let userMessage = "";
  let empID = "";
  let geography = "India";
  let email = "";

  // CHANGE 1: Use known working app name
  const APP_NAME = "llmApp"; 

  const MODEL_NAME = "aicoe-gpt-4o-mini-global-standard";
  const MODEL_PARAMS = {
    temperature: 0.1,
    max_tokens: 1500,
    top_p: 1.0, 
  };

  // console.log(`[${requestId}] Chat request started`);
  
  try {
    // ============== PARSE REQUEST ==============
    const body = await req.json();
    
    const { 
      messages, 
      empID: bodyEmpID, 
      email: bodyEmail, 
      otp, 
      userDetails, 
      geography: bodyGeography = "India",
      ndcCache, 
      ndcCacheTimestamp, 
      ticketCache, 
      ticketCacheTimestamp 
    } = body;
    
    requestId = body.requestId || `req_${Date.now()}`;
    sessionId = body.sessionId || `session_${Date.now()}`;

    // ============== STORE FOR LOGGING ==============
    empID = bodyEmpID;
    geography = bodyGeography;
    email = bodyEmail;

    // Initialize System Logger for infrastructure errors
    const systemLogger = await getSystemLogger({
      userId: empID,
      sessionId: sessionId,
      tags: ["chat_route", "azure_openai"]
    });
    
    // Extract user message (last message in array)
    userMessage = messages[messages.length - 1]?.content || "";

    // ============== VALIDATE AUTH ==============
    if (!empID || !email || !otp) {
      return new Response("Missing authentication credentials", { status: 401 });
    }

    const fullName = userDetails?.name || body.name || "";
    const firstName = fullName.split(' ')[0] || "there"; 

    // ============== CREATE TOOLS ==============
    const tools = createTools(
      geography, 
      empID, 
      email, 
      otp, 
      ndcCache, 
      ndcCacheTimestamp, 
      ticketCache, 
      ticketCacheTimestamp
    );

    systemPrompt = getSystemPrompt(geography, empID, email, firstName);
    
    // ============== WRAP streamText IN TRY-CATCH ==============
   let result;
    try {
      result = await streamText({
        model: azure(MODEL_NAME),
        temperature: MODEL_PARAMS.temperature,
        maxTokens: MODEL_PARAMS.max_tokens,
        messages: messages,
        //@ts-ignore
        tools: tools,
        system: systemPrompt,
        maxSteps: 5,

        // ============== ON FINISH CALLBACK - LOG SUCCESSFUL COMPLETION ==============
        onFinish: async (result) => {
          try {
            // console.log(`📊 [${requestId}] onFinish triggered`);
            
            const logger = await getLangfuseLogger({
                userId: empID,
                sessionId: sessionId,
                tags: ["chat", "production"]
            });

            // Clean strings (Standardize to double quotes AND REMOVE NEWLINES)
            const sanitizedSystemPrompt = cleanString(systemPrompt);
            const sanitizedUserMessage = cleanString(userMessage);
            const sanitizedOutput = cleanString(result.text);
            const sanitizedInput = cleanString(userMessage); 

            await logger.Send({
                promptName: "ChatPrompt",
                systemPrompt: sanitizedSystemPrompt,
                userMessage: sanitizedUserMessage,
                input: sanitizedInput,
                output: sanitizedOutput,
                userId: empID,
                sessionId: sessionId,
                version: "v1", // CHANGE 2: Match working version "v1"
                gen_version: "v1",
                level: "DEFAULT",
                statusMessage: "Success",
                model: MODEL_NAME,
                modelParams: {
                    temperature: MODEL_PARAMS.temperature,
                    max_tokens: MODEL_PARAMS.max_tokens,
                    top_p: MODEL_PARAMS.top_p
                },
                delay: Date.now() - requestStartTime,
                usageDetails: {
                    input: result.usage?.promptTokens || 0,
                    output: result.usage?.completionTokens || 0,
                    total_tokens: result.usage?.totalTokens || 0
                },
                labels: ["production"],
                metadata: {
                    retrieval_strategy: "ToolUse",
                    app_name: APP_NAME,
                    app_environment: process.env.ENV || "PROD",
                    message_id: requestId,
                    chat_id: sessionId,
                    category: "Chat"
                },
                config: {
                    model: MODEL_NAME,
                    temperature: MODEL_PARAMS.temperature,
                    supported_languages: ["en"]
                }
            });
            
            // console.log(`✅ [${requestId}] Logging dispatched successfully`);
          } catch (logError) {
            console.error(`❌ [${requestId}] onFinish logging error (non-critical):`, logError);
          }
        },        
        
        onStepFinish: async () => {
          // Step finished successfully
        },
        
        experimental_telemetry: {
          isEnabled: true,
          recordInputs: true,
          recordOutputs: true,
        }
      });
    } catch (streamError: any) {
      // ============== HANDLE STREAMING ERRORS ==============
      console.error(`❌ [${requestId}] streamText failed:`, streamError);

      // Log infrastructure failure to System Log (Service Bus)
      await systemLogger.logError("Chat_StreamText_Fail", streamError instanceof Error ? streamError : new Error(String(streamError)));
      
      const { userMessage: errorUserMsg, shouldRedirect, errorType } = categorizeError(streamError);
      
      // ============== LOG ERROR ==============
      if (empID && email) {
        try {
            const logger = await getLangfuseLogger({
                userId: empID,
                sessionId: sessionId,
                tags: ["chat", "error"]
            });

            await logger.Send({
                promptName: "ChatPrompt",
                systemPrompt: cleanString(systemPrompt),
                userMessage: cleanString(userMessage),
                input: cleanString(userMessage),
                output: cleanString(errorUserMsg),
                userId: empID,
                sessionId: sessionId,
                version: "v1", // CHANGE 2: Match working version "v1"
                gen_version: "v1",
                level: "ERROR",
                statusMessage: cleanString(streamError?.message || "Unknown Stream Error"),
                model: MODEL_NAME,
                modelParams: {
                    temperature: MODEL_PARAMS.temperature,
                    max_tokens: MODEL_PARAMS.max_tokens,
                    top_p: MODEL_PARAMS.top_p
                },
                delay: Date.now() - requestStartTime,
                usageDetails: { input: 0, output: 0, total_tokens: 0 },
                labels: ["error", errorType],
                metadata: {
                    retrieval_strategy: "ToolUse",
                    app_name: APP_NAME,
                    app_environment: process.env.ENV || "PROD",
                    message_id: requestId,
                    chat_id: sessionId,
                    category: "Error"
                },
                config: {
                    model: MODEL_NAME,
                    temperature: MODEL_PARAMS.temperature,
                    supported_languages: ["en"]
                }
            });
        } catch (logErr) {
            console.error("Failed to log stream error:", logErr);
        }
      }
      
      return createErrorStream(errorUserMsg, shouldRedirect, errorType);
    }
    
    // console.log(`✅ [${requestId}] Request completed successfully in ${Date.now() - requestStartTime}ms`);

    return result.toDataStreamResponse({
      getErrorMessage: (error: any) => {
        return "I encountered an error. Please try again or contact HR for assistance.";
      },
    });

  } catch (error: any) {
    console.error(`❌ [${requestId}] Unhandled error in POST handler:`, error);

    // Attempt to log critical failure if we can't even start the stream
    try {
      const fallbackLogger = await getSystemLogger({ userId: "unknown", sessionId: "critical_error" });
      await fallbackLogger.logError("Chat_Route_Critical", error instanceof Error ? error : new Error(String(error)));
    } catch (e) { console.error("Failed to log critical error to Service Bus", e); }
    
    const { userMessage: errorUserMsg, shouldRedirect, errorType } = categorizeError(error);
        
    // ============== LOG ERROR ==============
    if (empID && email) {
      try {
        const logger = await getLangfuseLogger({
            userId: empID,
            sessionId: sessionId,
            tags: ["chat", "fatal_error"]
        });

        await logger.Send({
            promptName: "ChatPrompt",
            systemPrompt: cleanString(systemPrompt || "Unknown"),
            userMessage: cleanString(userMessage || "Unknown"),
            input: "Request Body Parse Failed or Init Failed",
            output: cleanString(errorUserMsg),
            userId: empID || "unknown",
            sessionId: sessionId || "unknown",
            version: "v1", // CHANGE 2: Match working version "v1"
            gen_version: "v1",
            level: "ERROR",
            statusMessage: cleanString(error?.message || "Critical Handler Error"),
            model: MODEL_NAME,
            modelParams: {
                temperature: MODEL_PARAMS.temperature,
                max_tokens: MODEL_PARAMS.max_tokens,
                top_p: MODEL_PARAMS.top_p
            },
            delay: Date.now() - requestStartTime,
            usageDetails: { input: 0, output: 0, total_tokens: 0 },
            labels: ["critical", errorType],
            metadata: {
                retrieval_strategy: "None",
                app_name: APP_NAME,
                app_environment: process.env.ENV || "PROD",
                message_id: requestId,
                chat_id: sessionId,
                category: "CriticalError"
            },
            config: {
                model: MODEL_NAME,
                temperature: MODEL_PARAMS.temperature,
                supported_languages: ["en"]
            }
        });
      } catch (logErr) {
         console.error("Failed to log critical error:", logErr);
      }
    }

    return createErrorStream(errorUserMsg, shouldRedirect, errorType);
  }
}