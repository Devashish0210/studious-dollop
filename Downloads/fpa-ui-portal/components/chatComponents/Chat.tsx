"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { fetchGraphType, fetchConnectedDatabases, saveChatMessage, executeGlobalTemplate } from "@/lib/api";
import { GlobalTemplates } from "./GlobalTemplates";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import Insights from "./Insights";
import React from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import "../../app/globals.css";
import { AIInput } from "../InputWithSelectDatabase";
import ChatArtifacts from "./ChatArtifacts";

// Define the type definition of the ExtendedMessagePart
interface ExtendedMessagePart {
  toolInvocation?: ExtendedToolInvocation;
  text?: string;
  type?: string;
  state?: string;
}

// Define the type definition of the ExtendedToolInvocation
interface ExtendedToolInvocation {
  result?: {
    sql: string;
    queryResults: any[];
  };
  toolName?: string;
}

// Define the BotMessage interface
interface BotMessage {
  role: "user" | "assistant" | "bot";
  content: string | React.ReactNode;
  artifacts?: {
    tableData?: { columns: string[]; rows: any[][] } | null;
    graphData?: { data: any; type?: string } | null;
    codeData?: string | null;
    insightsData?: string | null;
  };
}

export default function Chat({ initialChatId, initialMessages }: { initialChatId?: string, initialMessages?: any[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [botMessages, setBotMessages] = useState<BotMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [databases, setDatabases] = useState<any[]>([]);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const lastSubmittedQueryRef = useRef<string>("");
  const [insightsLoadingMap, setInsightsLoadingMap] = useState<Record<number, boolean>>({});

  // Add state for chat_id and user_id
  const [chat_id, setChatId] = useState<string | undefined>(initialChatId);
  const user_id = (session as any)?.user?.id;

  // Fetch token from session storage and set it in state
  useEffect(() => {
    setToken((session as any)?.user?.accessToken);
  }, [session]);

  // Function to load databases from the API
  const fetchDatabases = useCallback(async () => {
    if (token) {
      try {
        setDbLoading(true);
        const dbs = await fetchConnectedDatabases((session as any)?.user?.accessToken);
        setDatabases(dbs || []);
        if (dbs?.length > 0) {
          setSelectedDatabaseId((prev) => {
            // Keep current selection if it exists in the new list, otherwise default to first
            if (prev && dbs.some((db: any) => db.db_connection_id === prev)) {
              return prev;
            }
            return dbs[0]?.db_connection_id;
          });
        }
        else {
          router.push("/databases");
        }
      } catch (err) {
        setDatabases([]);
        console.error("Failed to load databases:", err);
      } finally {
        setDbLoading(false);
      }
    };
  }, [token]);

  // Load databases when the component mounts
  useEffect(() => {
    fetchDatabases();
  }, [fetchDatabases]);

  const executionStarted = useRef(false);

   // Handle Global Template Execution from URL params
  useEffect(() => {
    const templateId = searchParams.get("templateId");
    const templateText = searchParams.get("text");

    if (templateId && templateText && selectedDatabaseId && token && !executionStarted.current) {
      executionStarted.current = true;
      const handleTemplateExecution = async () => {
        setLoading(true);

        // 1. Add user message
        const userMsg: BotMessage = { role: "user", content: templateText };
        setBotMessages([userMsg]);

        // 2. Save user message
        const saved = await saveChatMessage({
          user_id,
          chat_id: undefined,
          role: "user",
          content: templateText,
          token,
        });

        const newId = saved?.chat_id || initialChatId;
        if (newId) setChatId(newId);

        // 3. Execute Template
        const result = await executeGlobalTemplate(templateId, selectedDatabaseId);

        if (result && result.rows) {
          // Transform data for DataTable
          const columns = result.columns || [];
          const rows = result.rows.map((row: any) => Object.values(row));

          // Get graph recommendations
          const graphRecommendation = await fetchGraphType(templateText, result.rows);

          const assistantContent = `Here are the results for: "${templateText}"`;
          const assistantMsg: BotMessage = {
            role: "assistant",
            content: assistantContent,
            artifacts: {
              tableData: { columns, rows },
              graphData: {
                data: graphRecommendation?.formattedData || result.rows,
                type: graphRecommendation?.recommendedGraphs?.[0] || "bar"
              },
              codeData: result.sql || "Executed via template"
            }
          };

          // 4. Save Assistant message
          await saveChatMessage({
            user_id,
            chat_id: newId,
            role: "assistant",
            content: assistantContent,
            token,
          });

          setBotMessages(prev => [...prev, assistantMsg]);
        } else {
          setBotMessages(prev => [...prev, { 
            role: "assistant", 
            content: "I couldn't execute that template. Please try again or ask another question." 
          }]);
        }

        setLoading(false);

        // Fix URL formation: If we are already on a chat page, just replace the URL to clean params
        // If we are on the home page, redirect to the specific chat
        const targetPath = `/chat/${newId}`;
        if (window.location.pathname !== targetPath) {
          router.replace(targetPath);
        } else {
          router.replace(window.location.pathname); // Just strip search params
        }
      };

      handleTemplateExecution();
    }
  }, [searchParams, selectedDatabaseId, token, router]);

  // Scroll to bottom when new messages arrive

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [botMessages, loading]);

  // Initialize chat with useChat hook
  const { input, handleInputChange, handleSubmit, append, data } = useChat({
    api: "/copilot/fpa-chat/api/chat",
    body: { db_connection_id: selectedDatabaseId }, // Pass selected DB to API
    onFinish: async (message) => {
      try {
        let tempTableData = null;
        let tempGraphData = null;
        let tempCodeData = null;
        let responseContent = "";

        // Promise.all to handle multiple async operations
        await Promise.all(
          message?.parts?.map(async (part, index) => {
            // Type assertion to use the extended interface
            const messagePart = part as ExtendedMessagePart;
            // Check if the part is a tool invocation
            if (messagePart?.type === "tool-invocation") {
              const invocationTool = messagePart?.toolInvocation;
              if (invocationTool?.toolName === "generateSQLQuery") {
                const executionResult = invocationTool?.result;
                // If executionResult is available, process the SQL query
                if (executionResult) {
                  // Store SQL query
                  tempCodeData = executionResult?.sql || "No SQL query generated.";
                }
                else {
                  tempCodeData = "No SQL query generated.";
                }
              }
              else if (invocationTool?.toolName === "executeSQLQuery") {
                const executionResult = invocationTool?.result;
                // If executionResult is available, process the SQL query results
                if (executionResult) {
                  const columns = Object.keys(executionResult?.queryResults[0]);
                  const rows = executionResult?.queryResults?.map(
                    (obj: Record<string, any>) => Object.values(obj)
                  );
                  // Store table data
                  tempTableData = { columns, rows };

                  // Get graph recommendations
                  const graphRecommendation = await fetchGraphType(
                    input,
                    executionResult?.queryResults
                  );
                  const recommendedGraphType = graphRecommendation?.recommendedGraphs?.[0] || "bar";
                  const formattedData = graphRecommendation?.formattedData || executionResult?.queryResults;

                  // Store graph data
                  tempGraphData = {
                    data: formattedData,
                    type: recommendedGraphType,
                  };
                }
              }
              else if (invocationTool?.toolName === "executeFollowupSQLQueryTool") {
                const executionResult = invocationTool?.result;

                // If executionResult is available, process the SQL query
                if (executionResult) {
                  // Getting SQL Details ----------------------------------->
                  if (executionResult.sql) {
                    // Store SQL query
                    tempCodeData = executionResult?.sql || "No SQL query generated.";
                  }
                  else {
                    tempCodeData = "No SQL query generated.";
                  }

                  // Getting Result Table Details --------------------------->
                  if (executionResult.queryResults) {
                    const columns = Object.keys(executionResult?.queryResults[0]);
                    const rows = executionResult?.queryResults?.map(
                      (obj: Record<string, any>) => Object.values(obj)
                    );
                    // Store table data
                    tempTableData = { columns, rows };

                    // Get graph recommendations
                    const graphRecommendation = await fetchGraphType(
                      input,
                      executionResult?.queryResults
                    );
                    const recommendedGraphType = graphRecommendation?.recommendedGraphs?.[0] || "bar";
                    const formattedData = graphRecommendation?.formattedData || executionResult?.queryResults;

                    // Store graph data
                    tempGraphData = {
                      data: formattedData,
                      type: recommendedGraphType,
                    };
                  }
                }
              }
            } else if (messagePart?.type === "text" && (index === 0 || index === 1)) {
              // Non-tool parts
              responseContent = messagePart?.text || "No response generated.";
            }
          }) || []
        );

        const artifacts = {
          tableData: tempTableData,
          graphData: tempGraphData,
          codeData: tempCodeData,
        };
        const hasArtifacts = !!(tempTableData || tempGraphData || tempCodeData);

        if (hasArtifacts && !responseContent) {
          responseContent = `Here are the results for: "${lastSubmittedQueryRef.current}"`;
        }

        // Save assistant message
        if (user_id && token) {
          await saveChatMessage({
            user_id,
            chat_id,
            role: "assistant",
            content: responseContent,
            token,
          });
        }

        // Add combined message to chat
        setBotMessages((prevMessages) => [
          ...prevMessages,
          {
            role: "assistant",
            content: responseContent,
            artifacts: hasArtifacts ? artifacts : undefined,
          },
        ]);
      } catch (error) {
        console.error("Error processing query:", error);
        setBotMessages((prevMessages) => [
          ...prevMessages,
          {
            role: "assistant",
            content: "Sorry, I could not understand it. Can you please rephrase it?",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      // Reset loading state on error
      setLoading(false);
    },
    // Initial messages to display when the chat loads
    initialMessages: [
      {
        id: "initial",
        role: "assistant",
        content:
          "Hello! I am Microland's FPA assistant. I can help you query and analyze your database. What would you like to know?",
      },
    ],
  });

  // Function to send message on form submit
  const sendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    lastSubmittedQueryRef.current = input;
    setLoading(true);
    setBotMessages((prevMessages) => [
      ...prevMessages,
      { role: "user", content: input },
    ]);
    // Save user message
    if (user_id && token) {
      try {
        const saved = await saveChatMessage({
          user_id,
          chat_id,
          role: "user",
          content: input,
          token,
        });
        if (saved?.chat_id) setChatId(saved.chat_id);
      } catch (error) {
        console.error("Failed to save chat message:", error);
      }
    }
    handleSubmit(e as any);
  };

  const handleGenerateInsights = async (index: number) => {
    setInsightsLoadingMap((prev) => ({ ...prev, [index]: true }));

    try {
      const currentHistory = botMessages.slice(0, index + 1).map((m) => ({
        role: m.role,
        content: m.content as string,
      }));
      const messagesPayload = [
        ...currentHistory,
        { role: "user", content: "Generate insights for the data above." },
      ];

      const response = await fetch("/copilot/fpa-chat/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messagesPayload,
          db_connection_id: selectedDatabaseId,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch insights");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = "";

      while (!done && reader) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          accumulatedText += decoder.decode(value, { stream: true });
        }
      }

      // Parse Vercel AI SDK stream format (e.g., 0:"text")
      const cleanText = accumulatedText
        .split("\n")
        .filter(line => line.startsWith("0:")) // Only process text parts
        .map((line) => {
          try {
            // The format is 0:"content", so we slice off the first 2 chars and parse the JSON string
            return JSON.parse(line.substring(2));
          } catch (e) {
            console.warn("Failed to parse line:", line);
            return "";
          }
        })
        .join("");
      
      if (user_id && token) {
        await saveChatMessage({
          user_id,
          chat_id,
          role: "assistant",
          content: cleanText,
          token,
        });
      }

      setBotMessages((prev) => {
        const newMessages = [...prev];
        // Ensure we handle the update immutably for React to detect the change
        if (newMessages[index]) {
            const updatedMessage = { ...newMessages[index] };
            updatedMessage.artifacts = {
              ...(updatedMessage.artifacts || {}),
              insightsData: cleanText
            };
            newMessages[index] = updatedMessage;
        }
        return newMessages;
      });
    } catch (error) {
      console.error("Error generating insights:", error);
    } finally {
      setInsightsLoadingMap((prev) => ({ ...prev, [index]: false }));
    }
  };

  // Function to handle key down events for input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as any);
    }
  };

  // Add useEffect to set initial message when component mounts
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setBotMessages(initialMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })));
    }
  }, [initialMessages]);

  // Function to get loading message based on current state
  const getLoadingMessage = (switchState: string) => {
    switch (switchState) {
      case "fetchingSQL":
        return "Generating SQL Query...";
      case "executingSQL":
        return "Executing SQL Query...";
      case "fetchingGraphs":
        return "Creating Visualizations...";
      case "generatingInsights":
        return "Analyzing Data for Meaningful Insights...";
      case "completed":
        return "Processing Complete! Preparing Results...";
      default:
        return "Assistant is thinking...";
    }
  };

  return (
    <div className={cn(
      "flex h-full relative overflow-hidden bg-[var(--color-bg-dark)] text-[var(--color-text-light)]"
    )}>
      {/* Main Chat UI */}
      <div
        className="flex-grow flex flex-col h-full overflow-hidden w-full transition-all duration-300"
        style={{ width: "100%" }}
      >
        <div
          ref={chatContainerRef}
          className="flex-grow overflow-y-auto px-4 py-4 pb-0 mb-0"
        >
          {botMessages.length === 0 && !loading && (
             <div className="h-full flex flex-col items-center justify-center p-4 md:p-8 pt-20 md:pt-15 text-center">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-full md:max-w-2xl w-full flex flex-col items-center px-4"
              >
                 <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mb-3 break-words">
                  Financial Insights Assistant
                </h2>
                <p className="text-muted-foreground text-lg">
                  Analyze your financial data with natural language. Choose a suggested query or type your own below.
                </p>
                <GlobalTemplates
          onQuerySelect={(text) =>
            append({ role: "user", content: text })
          }
        />
              </motion.div>
            </div>
          )}
          {botMessages?.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-4 md:mb-6"
            >
              {/* All messages aligned to the left */}
             <div className={cn("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("flex items-start", msg.role === "user" ? "max-w-[80%] flex-row-reverse" : "w-full max-w-[950px] flex-row")}>
                  <div
                    className={cn(
                      "p-2 md:p-3 rounded-2xl text-sm md:text-base break-words w-full overflow-hidden",
                      msg?.role === "user"
                        ? "bg-[var(--color-button-highlight)] text-white rounded-tl-none"
                        : "bg-neutral-800 text-[var(--color-text-light)]"
                    )}
                  >
                    {msg?.role === "assistant" ? (
                      <div>
                        <Insights insights={msg.content as string} hideHeader={true} />
                        
                        {/* Artifacts rendered inline */}
                        {msg.artifacts && (
                           <ChatArtifacts 
                             {...msg.artifacts} 
                             insightsData={msg.artifacts.insightsData}
                             isGeneratingInsights={insightsLoadingMap[index]}
                             onGenerateInsights={() => handleGenerateInsights(index)}
                           />
                        )}
                      </div>
                    ) : (
                      /* Use Insights component to render markdown for standard messages */
                      <Insights insights={msg.content as string} hideHeader={true} />
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Animated Waiting Messages until we get the full response from the Bot */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                repeatType: "reverse",
              }}
              className={cn(
                "mb-4 md:mb-6 flex text-xs md:text-sm",
                "text-neutral-500"
              )}
            >
              <div className="p-2 md:p-3 rounded-2xl text-sm md:text-base">
                {/* Show the response status received from the Stream Chat else show default message */}
                {data?.length
                  ? getLoadingMessage(
                    (data[data.length - 1] as any)?.state ?? ""
                  )
                  : "Assistant is thinking..."}
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Field for the user to Chat */}
        <div className="w-full max-w-4xl mx-auto px-4 py-2 bg-[var(--color-bg-dark)] border-t border-neutral-800">
          <AIInput
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={sendMessage}
            isLoading={loading}
            databases={databases}
            selectedDatabaseId={selectedDatabaseId}
            setSelectedDatabaseId={setSelectedDatabaseId}
            dbLoading={dbLoading}
          />
        </div>
      </div>
    </div>
  );
}