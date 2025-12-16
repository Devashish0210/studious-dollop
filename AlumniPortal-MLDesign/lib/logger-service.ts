// logger.ts (with Zod validation for SystemLogger, LangfuseLogger and FeedbackLogger)
import { ServiceBusClient, ServiceBusMessage, ServiceBusSender } from "@azure/service-bus";
import { z } from "zod";

/**
 * Common types
 */
type LogLevel = "INFO" | "ERROR" | "DEFAULT";

export interface BaseOptions {
  connectionString?: string; // if not provided will fallback to env
  queueName?: string; // same
  appName?: string;
  appId?: string;
  env?: string;
}

/**
 * ---------- Zod Schemas (NO optional fields) ----------
 *
 * Every field in the schemas below is required (no .optional()) — callers must provide
 * and normalize all fields before sending.
 */

/* --- System log schemas --- */
const SystemRecordSchema = z.object({
  USER_ID: z.string(),
  SESSION_ID: z.string(),
  LEVEL: z.string(),
  MESSAGE: z.string(),
  SOURCE: z.string(),
  TAGS: z.array(z.string()),
  APP_NAME: z.string(),
  APP_ID: z.string(),
});

const SystemLogSchema = z.object({
  TYPE: z.literal("OB"),
  DATASET: z.string(),
  RECORDS: z.array(SystemRecordSchema),
});

/* --- Langfuse (LF) schemas --- */
const GenMetadataSchema = z.object({
  retrieval_strategy: z.string(),
  app_name: z.string(),
  app_environment: z.string(),
  message_id: z.string(),
  chat_id: z.string(),
  category:z.string(),
});

const ModelParamsSchema = z.object({
  temperature: z.number(),
  max_tokens: z.number(),
  top_p: z.number(),
});

const UsageDetailsSchema = z.object({
  input: z.number(),
  output: z.number(),
  total_tokens: z.number(),
});

const ConfigDetailsSchema = z.object({
  model: z.string(),
  temperature: z.number(),
  supported_languages: z.array(z.string()),
});

const LangfusePayloadSchema = z.object({
  TYPE: z.literal("LF"),
  "PROMPT-NAME": z.string(),
  SYSTEM_PROMPT: z.string(),
  USER_MESSAGE: z.string(),
  OUTPUT: z.string(),
  INPUT: z.string(),
  USER_ID: z.string(),
  SESSION_ID: z.string(),
  VERSION: z.string(),
  TAGS: z.array(z.string()),
  METADATA: GenMetadataSchema,
  GEN_VERSION: z.string(),
  LEVEL: z.string(),
  STATUS_MESSAGE: z.string(),
  MODEL: z.string(),
  MODEL_PARAMS: ModelParamsSchema,
  DELAY: z.number(),
  USAGE_DETAILS: UsageDetailsSchema,
  LABELS: z.array(z.string()),
  CONFIG: ConfigDetailsSchema,
});

/* --- Feedback schemas (LFTU) --- */
const MessageFeedbackSchema = z.object({
  TYPE: z.literal("LFTU"),
  APP_NAME: z.string(),
  APP_ENVIRONMENT: z.string(),
  USER_ID: z.string(),
  CHAT_ID: z.string(),
  MESSAGE_ID: z.string(),
  FEEDBACK: z.boolean(),
});

const ChatFeedbackSchema = z.object({
  TYPE: z.literal("LFTU"),
  APP_NAME: z.string(),
  APP_ENVIRONMENT: z.string(),
  USER_ID: z.string(),
  CHAT_ID: z.string(),
  COMMENT: z.string(),
  RATING: z.number(),
});

const FeedbackSchema = z.union([MessageFeedbackSchema, ChatFeedbackSchema]);

/* ---------- Generic ServiceBus helper (singleton) ---------- */
export class ServiceBusHelper {
  private static instance: ServiceBusHelper | null = null;

  private connectionString: string;
  private queueName: string;

  private sbClient: ServiceBusClient;
  private sender: ServiceBusSender;

  private constructor(connectionString?: string, queueName?: string) {
    this.connectionString = connectionString || process.env.SERVICE_BUS_CONNECTION_STR || "";
    this.queueName = queueName || process.env.QUEUE_NAME || "";
    if (!this.connectionString || !this.queueName) {
      throw new Error("ServiceBus connection string and queue name must be provided (env or getInstance args).");
    }

    this.sbClient = new ServiceBusClient(this.connectionString);
    this.sender = this.sbClient.createSender(this.queueName);
  }

  public static getInstance(connectionString?: string, queueName?: string): ServiceBusHelper {
    if (!ServiceBusHelper.instance) {
      ServiceBusHelper.instance = new ServiceBusHelper(connectionString, queueName);
    } else {
      if (
        connectionString &&
        queueName &&
        (ServiceBusHelper.instance.connectionString !== connectionString ||
          ServiceBusHelper.instance.queueName !== queueName)
      ) {
        console.warn(
          "[ServiceBusHelper] getInstance called with different connection/queue than existing instance. Existing singleton will be reused. Call .close() first if you want to recreate."
        );
      }
    }
    return ServiceBusHelper.instance;
  }

  public async send(body: unknown): Promise<void> {
    const sbMessage: ServiceBusMessage = {
      body,
      contentType: "application/json",
    };

    try {
      await this.sender.sendMessages(sbMessage);
    } catch (err) {
      console.error("[ServiceBusHelper] send error:", err);
      throw err;
    }
  }

  public async close(): Promise<void> {
    try {
      await this.sender.close();
      await this.sbClient.close();
    } catch (err) {
      console.warn("[ServiceBusHelper] error while closing:", err);
    } finally {
      ServiceBusHelper.instance = null;
    }
  }
}

// graceful close on process exit
process.on("beforeExit", async () => {
  if (ServiceBusHelper["instance"]) {
    try {
      const inst: ServiceBusHelper | null = ServiceBusHelper["instance"];
      if (inst) {
        await inst.close();
        console.info("[ServiceBusHelper] closed ServiceBus client on process beforeExit");
      }
    } catch (err) {
      console.error("[ServiceBusHelper] failed to close on process beforeExit:", err);
    }
  }
});

/**
 * ---------- Helpers ----------
 */
function getCallerLocation() {
  const stack = new Error().stack?.split("\n")[3] || "";
  const match = stack.match(/\((.*):(\d+):(\d+)\)/);
  return {
    file: match ? match[1] : "unknown",
    line: match ? match[2] : "unknown",
  };
}

/**
 * ---------- System Logger ----------
 */
export class SystemLogger {
  protected sb: ServiceBusHelper;
  protected appName: string;
  protected appId: string;
  protected tags: string[];
  protected userId: string;
  protected sessionId: string;

  constructor(
    appName: string,
    appId: string,
    options: {
      tags: string[];
      userId: string;
      sessionId: string;
    }
  ) {
    this.sb = ServiceBusHelper.getInstance();
    this.appName = appName;
    this.appId = appId;
    this.tags = options.tags;
    this.userId = options.userId;
    this.sessionId = options.sessionId;
  }

  protected buildPayload(message: string, level: LogLevel, source: string) {
    return {
      TYPE: "OB" as const,
      DATASET: "system_logs",
      RECORDS: [
        {
          USER_ID: this.userId || "unknown",
          SESSION_ID: this.sessionId || "unknown",
          LEVEL: level,
          MESSAGE: message,
          SOURCE: source,
          TAGS: this.tags || [],
          APP_NAME: this.appName,
          APP_ID: this.appId,
        },
      ],
    };
  }

  async sendLogToServiceBus(message: string, level: LogLevel, source: string) {
    const payload = this.buildPayload(message, level, source);
    try {
      // Validate with Zod (will throw if invalid)
      SystemLogSchema.parse(payload);
      await this.sb.send(payload);
      console.log("Sent system log to service bus");
    } catch (err) {
      console.error("Failed to send system log (validation/send error):", err);
      throw err;
    }
  }

  logStart(funcName: string) {
    const { file, line } = getCallerLocation();
    const timestamp = new Date().toISOString();
    const msg = `[START] ${funcName} | File: ${file} | Line: ${line} | Time: ${timestamp}`;
    console.info(msg);
    if (process.env.ENV === "PROD") {
      this.sendLogToServiceBus(msg, "INFO", file).catch(console.error);
    }
    return { startTime: Date.now() };
  }

  logEnd(funcName: string, startTime: number) {
    const { file, line } = getCallerLocation();
    const duration = Date.now() - startTime;
    const msg = `[END] ${funcName} | Success | Duration: ${duration}ms | File: ${file} | Line: ${line}`;
    console.info(msg);
    if (process.env.ENV === "PROD") {
      this.sendLogToServiceBus(msg, "INFO", file).catch(console.error);
    }
  }

  async logError(funcName: string, err: Error) {
    const { file, line } = getCallerLocation();
    const timestamp = new Date().toISOString();
    const msg = `[ERROR] ${funcName} | File: ${file} | Line: ${line} | Time: ${timestamp} | 
    Exception: ${err.message} | Stack: ${err.stack}`;
    console.error(msg);
    if (process.env.ENV === "PROD") {
      await this.sendLogToServiceBus(msg, "ERROR", file);
    }
  }
}

/**
 * ---------- Langfuse / LLM Logger ----------
 */
export class LangfuseLogger {
  protected sb: ServiceBusHelper;
  protected Tags: string[];
  protected appName: string;
  protected appEnv: string;
  protected UserId: string;
  protected SessionId: string;

  constructor(opts: {
    appName: string;
    appEnv: string;
    Tags: string[];
    UserId: string;
    SessionId: string;
  }) {
    this.sb = ServiceBusHelper.getInstance();
    this.appName = opts.appName;
    this.appEnv = opts.appEnv;
    this.Tags = opts.Tags;
    this.UserId = opts.UserId;
    this.SessionId = opts.SessionId;
  }

  private buildLangfusePayload(input: {
    promptName: string;
    systemPrompt: string;
    userMessage: string;
    output: string;
    input: string;
    userId: string;
    sessionId: string;
    version: string;
    metadata: z.infer<typeof GenMetadataSchema>;
    gen_version: string;
    level: string;
    statusMessage: string;
    model: string;
    modelParams: z.infer<typeof ModelParamsSchema>;
    delay: number;
    usageDetails: z.infer<typeof UsageDetailsSchema>;
    labels: string[];
    config: z.infer<typeof ConfigDetailsSchema>;
  }) {
    return {
      "PROMPT-NAME": input.promptName,
      SYSTEM_PROMPT: input.systemPrompt,
      USER_MESSAGE: input.userMessage,
      OUTPUT: input.output,
      INPUT: input.input,
      USER_ID: input.userId || this.UserId || "unknown",
      SESSION_ID: input.sessionId || this.SessionId || "unknown",
      VERSION: input.version,
      TAGS: this.Tags,
      METADATA: input.metadata,
      GEN_VERSION: input.gen_version,
      LEVEL: input.level,
      STATUS_MESSAGE: input.statusMessage,
      MODEL: input.model,
      MODEL_PARAMS: input.modelParams,
      DELAY: (input.delay),
      USAGE_DETAILS: input.usageDetails,
      LABELS: input.labels,
      CONFIG: input.config,
      TYPE: "LF" as const,
    };
  }

  async Send(dynamic: {
    promptName: string;
    systemPrompt: string;
    userMessage: string;
    output: string;
    input: string;
    userId: string;
    sessionId: string;
    version: string;
    metadata: z.infer<typeof GenMetadataSchema>;
    gen_version: string;
    level: string;
    statusMessage: string;
    model: string;
    modelParams: z.infer<typeof ModelParamsSchema>;
    delay: number;
    usageDetails: z.infer<typeof UsageDetailsSchema>;
    labels: string[];
    config: z.infer<typeof ConfigDetailsSchema>;
  }) {
    const payload = this.buildLangfusePayload(dynamic);
    try {
      // Strict validation — throws if any field missing / wrong type
      LangfusePayloadSchema.parse(payload);
      console.log("Langfuse payload validated:");
      await this.sb.send(payload);
    } catch (err) {
      console.error("Failed to send Langfuse payload (validation/send error):", err);
      throw err;
    }
  }
}

/**
 * ---------- Feedback Logger ----------
 */
export type MessageFeedbackPayload = {
  APP_NAME: string;
  APP_ENVIRONMENT: string;
  USER_ID: string;
  CHAT_ID: string;
  MESSAGE_ID: string;
  FEEDBACK: boolean;
  TYPE: "LFTU";
};

export type ChatFeedbackPayload = {
  APP_NAME: string;
  APP_ENVIRONMENT: string;
  USER_ID: string;
  CHAT_ID: string;
  COMMENT: string;
  RATING: number;
  TYPE: "LFTU";
};

export type FeedbackPayload = MessageFeedbackPayload | ChatFeedbackPayload;

export class FeedbackLogger {
  protected sb: ServiceBusHelper;
  protected appName: string;
  protected appEnv: string;
  protected userId: string;

  constructor(opts: { appName: string; appEnv: string; userId: string }) {
    this.sb = ServiceBusHelper.getInstance();
    this.appName = opts.appName;
    this.appEnv = opts.appEnv;
    this.userId = opts.userId;
  }

  async sendFeedback(payload: FeedbackPayload) {
    try {
      // Validate against the union (one of the two forms must match)
      FeedbackSchema.parse(payload);
      await this.sb.send(payload);
    } catch (err) {
      console.error("Failed to send feedback payload (validation/send error):", err);
      throw err;
    }
  }

  async SendMessageFeedback(input: { chatId: string; messageId: string; feedback: boolean }) {
    const finalPayload: MessageFeedbackPayload = {
      APP_NAME: this.appName,
      APP_ENVIRONMENT: this.appEnv,
      USER_ID: this.userId,
      CHAT_ID: input.chatId,
      MESSAGE_ID: input.messageId,
      FEEDBACK: input.feedback,
      TYPE: "LFTU",
    };
    await this.sendFeedback(finalPayload);
  }

  async SendChatFeedback(input: { chatId: string; comment: string; rating: number }) {
    const finalPayload: ChatFeedbackPayload = {
      APP_NAME: this.appName,
      APP_ENVIRONMENT: this.appEnv,
      USER_ID: this.userId,
      CHAT_ID: input.chatId,
      COMMENT: input.comment,
      RATING: input.rating,
      TYPE: "LFTU",
    };
    await this.sendFeedback(finalPayload);
  }
}

/* Module exports */
export default {
  SystemLogger,
  LangfuseLogger,
  FeedbackLogger,
};
