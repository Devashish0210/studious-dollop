"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { fetchGraphType, fetchConnectedDatabases, saveChatMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Send,
  BarChart,
  Table,
  Code,
  X,
  PanelRight,
  Sparkles,
} from "lucide-react";
import DataTable from "./DataTable";
import CustomizableGraph from "./../queryComponents/customizableGraph";
import Insights from "./Insights";
import CodeDisplay from "./CodeDisplay";
import React from "react";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { motion } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import "../../app/globals.css";
import { AIInput } from "../InputWithSelectDatabase";

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
  hasDataButtons?: boolean;
  responseContent?: string;
  insightsContent?: string;
}

export default function Chat({ initialChatId, initialMessages }: { initialChatId?: string, initialMessages?: any[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [botMessages, setBotMessages] = useState<BotMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("table");
  const [sidebarContent, setSidebarContent] = useState<React.ReactNode | null>(
    null
  );
  const [hasTableData, setHasTableData] = useState<boolean>(false);
  const [hasGraphData, setHasGraphData] = useState<boolean>(false);
  const [hasCodeData, setHasCodeData] = useState<boolean>(false);
  const [tableData, setTableData] = useState<{
    columns: string[];
    rows: any[][];
  } | null>(null);
  const [graphData, setGraphData] = useState<{
    data: any;
  } | null>(null);
  const [codeData, setCodeData] = useState<string>("");
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [artifactsPanelWidth, setArtifactsPanelWidth] = useState<number>(500);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const [hasArtifacts, setHasArtifacts] = useState<boolean>(false);
  const [showMobileSheet, setShowMobileSheet] = useState<boolean>(false);
  // New state to control the visibility of the artifacts panel
  const [isArtifactsPanelOpen, setIsArtifactsPanelOpen] =
    useState<boolean>(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [databases, setDatabases] = useState<any[]>([]);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);
  const lastSubmittedQueryRef = useRef<string>("");

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
          setSelectedDatabaseId(dbs[0]?.db_connection_id);
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

  
  // Check if it's mobile device
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkIsMobile();

    // Add event listener for window resize
    window.addEventListener("resize", checkIsMobile);

    // Clean up
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  // Handle drawer resizing
  useEffect(() => {
    // Function to handle mouse down events for resizing
    const handleMouseDown = (e: MouseEvent) => {
      if (resizeHandleRef.current?.contains(e.target as Node)) {
        setIsResizing(true);
      }
    };

    // Function to handle mouse move events
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Calculate new width
      const newWidth = window.innerWidth - e.clientX;

      // Limit minimum and maximum width
      const limitedWidth = Math.max(
        300,
        Math.min(newWidth, window.innerWidth * 0.7)
      );

      setArtifactsPanelWidth(limitedWidth);
    };

    // Function to handle mouse up events
    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Update hasArtifacts state when data is available
  useEffect(() => {
    setHasArtifacts(hasTableData || hasGraphData || hasCodeData);
  }, [hasTableData, hasGraphData, hasCodeData]);

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
        // Reset data availability flags
        let hasTable = false;
        let hasGraph = false;
        let hasCode = false;
        let tempTableData = null;
        let tempGraphData = null;
        let tempCodeData = "";
        let insightsContent = "";
        let responseContent = "";

        // Promise.all to handle multiple async operations
        const processedParts = await Promise.all(
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
                  hasCode = true;
                }
                else {
                  tempCodeData = "No SQL query generated.";
                  hasCode = false;
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
                  hasTable = true;

                  // Get graph recommendations
                  const graphRecommendation = await fetchGraphType(
                    input,
                    executionResult?.queryResults
                  );
                  const recommendedGraphType = graphRecommendation?.recommendedGraphs?.[0] || "bar";
                  const formattedData = graphRecommendation?.formattedData || executionResult?.queryResults;

                  // Store graph data
                  hasGraph = true;
                  tempGraphData = {
                    data: formattedData,
                    type: recommendedGraphType,
                  };

                  responseContent = `Here are the results for: "${lastSubmittedQueryRef.current}"`;
                  insightsContent = message?.content || "No Insights generated!";
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
                }
              }
            }
            else {
              // Non-tool parts
              if ((index === 0 || index === 1) && messagePart?.type === "text") {
                responseContent = messagePart?.text || "No response generated.";
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
              }
            }
          }) || []
        );

        // Update state with new data
        setHasTableData(hasTable);
        setHasGraphData(hasGraph);
        setHasCodeData(hasCode);
        if (hasTable && tempTableData) setTableData(tempTableData);
        if (hasGraph && tempGraphData) setGraphData(tempGraphData);
        if (hasCode) setCodeData(tempCodeData);

        // Add combined message to chat
        setBotMessages((prevMessages) => [
          ...prevMessages,
          {
            role: "assistant",
            content: "",
            hasDataButtons: hasTable || hasGraph || hasCode,
            responseContent: responseContent,
            insightsContent: insightsContent,
          },
        ]);
      } catch (error) {
        console.error("Error processing query:", error);
        setBotMessages((prevMessages) => [
          ...prevMessages,
          {
            role: "assistant",
            content: "Sorry, I could not understand it. Can you please rephrase it?",
            hasDataButtons: false,
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

  // Function to handle button clicks
  const handleButtonClick = (type: string) => {
    setActiveTab(type);

    let content = null;
    // Check which type of content to display based on button click
    switch (type) {
      // Display table data
      case "table":
        content = tableData ? (
          <DataTable data={tableData} />
        ) : (
          <div className="p-4 text-neutral-500">No table data available</div>
        );
        break;
      // Display graph data
      case "graph":
        content = graphData ? (
          <CustomizableGraph data={graphData?.data} />
        ) : (
          <div className="p-4 text-neutral-500">No graph data available</div>
        );
        break;
      // Display SQL code
      case "code":
        content = <CodeDisplay sqlQuery={codeData || ""} />;
        break;
    }

    setSidebarContent(content);
  };

  // Toggle artifacts panel visibility
  const toggleArtifactsPanel = () => {
    if (isMobile) {
      setShowMobileSheet(!showMobileSheet);
      // Show table by default when opening on mobile
      if (!showMobileSheet && hasTableData) {
        handleButtonClick("table");
      }
    } else {
      setIsArtifactsPanelOpen(!isArtifactsPanelOpen);
      // Show table by default when opening on desktop
      if (!isArtifactsPanelOpen && hasTableData) {
        handleButtonClick("table");
      }
    }
  };

  return (
    <div className={cn(
      "flex h-full relative overflow-hidden bg-[var(--color-bg-dark)] text-[var(--color-text-light)]"
    )}>
      {/* Main Chat UI */}
      <div
        className={`flex-grow flex flex-col h-full overflow-hidden transition-all duration-300 ${isArtifactsPanelOpen && !isMobile
          ? `pr-${artifactsPanelWidth}px`
          : "pr-4"
          }`}
        style={{
          width:
            isArtifactsPanelOpen && !isMobile
              ? `calc(100% - ${artifactsPanelWidth}px)`
              : "100%",
        }}
      >
        <div
          ref={chatContainerRef}
          className="flex-grow overflow-y-auto p-4 pb-0 mb-0"
        >
          {botMessages?.map((msg, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-4 md:mb-6"
            >
                {/* All messages aligned to the left */}
                <div className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("flex items-start max-w-[80%]", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                  <div
                    className={cn(
                      "p-2 md:p-3 rounded-2xl text-sm md:text-base break-words",
                      msg?.role === "user"
                        ? "bg-[var(--color-button-highlight)] text-[var(--color-text-highlight)] rounded-tl-none"
                        : "bg-neutral-800 text-[var(--color-text-light)]"
                    )}
                  >
                    {msg?.role === "assistant" && "responseContent" in msg ? (
                      <div>
                        <div>{msg.responseContent}</div>

                        {/* Button to open artifacts/Results drawer */}
                        {msg?.hasDataButtons && (
                          <div className="flex flex-wrap mt-2 mb-2 gap-2">
                            <Button
                              onClick={toggleArtifactsPanel}
                              variant={
                                activeTab === "table" && isArtifactsPanelOpen
                                  ? "default"
                                  : "outline"
                              }
                              size="sm"
                              className={cn(
                                "flex items-center space-x-1 text-xs md:text-sm h-7 md:h-8 transition-all",
                                "bg-[var(--color-bg-dark)] border border-neutral-700 text-[var(--color-text-light)] hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
                              )}
                            >
                              <PanelRight className="h-4 w-4 mr-1" />
                              Results
                            </Button>

                            <Button
                              onClick={() => append({ role: "user", content: "Generate insights for the data above." })}
                              variant="outline"
                              size="sm"
                              className={cn(
                                "flex items-center space-x-1 text-xs md:text-sm h-7 md:h-8 transition-all",
                                "bg-[var(--color-bg-dark)] border border-neutral-700 text-[var(--color-text-light)] hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
                              )}
                            >
                              <Sparkles className="h-4 w-4 mr-1" />
                              Generate Insights
                            </Button>
                          </div>
                        )}

                        {/* Insights after the buttons */}
                        {msg.insightsContent && (
                          <Insights insights={msg.insightsContent} />
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
        <div className="sticky bottom-0 w-full px-4 pb-4 bg-[var(--color-bg-dark)] border-t border-neutral-800">
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

      {/* Render mobile artifacts panel or desktop artifacts panel */}
      {!isMobile ? (
        isArtifactsPanelOpen && (
          <div className="relative">
            {/* Resize handle */}
            <div
              ref={resizeHandleRef}
              className="absolute left-0 top-0 bottom-0 w-1 bg-neutral-700 hover:bg-neutral-500 z-10"
              style={{ cursor: "ew-resize" }}
            />

            {/* Artifacts Panel */}
            <div
              className={cn(
                "border-l shadow-lg overflow-y-auto transition-all duration-300 bg-neutral-900 border-neutral-700"
              )}
              style={{
                width: artifactsPanelWidth,
                maxHeight: "calc(100vh - 100px)",
              }}
            >
              <div className="px-4 pt-4 h-full flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <h3 className={cn(
                    "text-lg font-medium text-[var(--color-text-light)]"
                  )}>
                    Artifacts
                  </h3>
                  <Button
                    onClick={toggleArtifactsPanel}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "transition-colors",
                      "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
                    )}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Tabs for different content types */}
                <Tabs
                  defaultValue={activeTab}
                  value={activeTab}
                  className="w-full"
                >
                  <TabsList className={cn(
                    "grid grid-cols-3 mb-2 bg-neutral-800"
                  )}>
                    <TabsTrigger
                      value="table"
                      disabled={!hasTableData}
                      onClick={() => handleButtonClick("table")}
                      className={cn(
                        "transition-colors",
                        "data-[state=active]:bg-[var(--color-button-highlight)] data-[state=active]:text-[var(--color-text-highlight)]"
                      )}
                    >
                      <Table className="h-4 w-4 mr-2" />
                      Table
                    </TabsTrigger>
                    <TabsTrigger
                      value="graph"
                      disabled={!hasGraphData}
                      onClick={() => handleButtonClick("graph")}
                      className={cn(
                        "transition-colors",
                        "data-[state=active]:bg-[var(--color-button-highlight)] data-[state=active]:text-[var(--color-text-highlight)]"
                      )}
                    >
                      <BarChart className="h-4 w-4 mr-2" />
                      Graph
                    </TabsTrigger>
                    <TabsTrigger
                      value="code"
                      disabled={!hasCodeData}
                      onClick={() => handleButtonClick("code")}
                      className={cn(
                        "transition-colors",
                        "data-[state=active]:bg-[var(--color-button-highlight)] data-[state=active]:text-[var(--color-text-highlight)]"
                      )}
                    >
                      <Code className="h-4 w-4 mr-2" />
                      SQL
                    </TabsTrigger>
                  </TabsList>

                  <div className={cn(
                    "flex-grow overflow-auto border rounded-lg p-3 border-neutral-700 bg-neutral-900"
                  )}>
                    {sidebarContent}
                  </div>
                </Tabs>
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          {/* Button to open artifacts drawer on mobile */}
          {hasArtifacts && (
            <Button
              onClick={() => setShowMobileSheet(true)}
              className={cn(
                "fixed bottom-20 right-4 z-20 flex items-center gap-2 transition-all",
                "bg-neutral-700 hover:bg-neutral-600"
              )}
              size="sm"
            >
              <PanelRight className="h-4 w-4" />
              Artifacts
            </Button>
          )}

          <Sheet open={showMobileSheet} onOpenChange={setShowMobileSheet}>
            <SheetContent side="right" className={cn(
              "w-full sm:max-w-full p-0 bg-[var(--color-bg-dark)]"
            )}>
              <SheetHeader className={cn(
                "p-4 border-b border-neutral-700"
              )}>
                <SheetTitle className="text-[var(--color-text-light)]">
                  Artifacts
                </SheetTitle>
              </SheetHeader>
              <div className="p-4">
                <Tabs
                  defaultValue={activeTab}
                  value={activeTab}
                  className="w-full"
                >
                  <TabsList className={cn(
                     "grid grid-cols-3 mb-4 bg-neutral-800"
                  )}>
                    <TabsTrigger
                      value="table"
                      disabled={!hasTableData}
                      onClick={() => handleButtonClick("table")}
                    >
                      <Table className="h-4 w-4 mr-2" />
                      Table
                    </TabsTrigger>
                    <TabsTrigger
                      value="graph"
                      disabled={!hasGraphData}
                      onClick={() => handleButtonClick("graph")}
                    >
                      <BarChart className="h-4 w-4 mr-2" />
                      Graph
                    </TabsTrigger>
                    <TabsTrigger
                      value="code"
                      disabled={!hasCodeData}
                      onClick={() => handleButtonClick("code")}
                    >
                      <Code className="h-4 w-4 mr-2" />
                      SQL
                    </TabsTrigger>
                  </TabsList>

                  <div className={cn(
                    "flex-grow overflow-auto border rounded-lg p-3 border-neutral-700 bg-neutral-900"
                  )}>
                    {sidebarContent}
                  </div>
                </Tabs>
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
