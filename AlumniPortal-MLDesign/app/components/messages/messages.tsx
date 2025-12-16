import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AIInput } from "../ui/ai-input";
import { MessageContainer } from "./message-container";
import TicketStatusTable from "./ticket-status-table";
import { FeedbackButtons } from "./FeedbackButtons";
import "../../../app/globals.css";

export const Messages = ({
  //@ts-ignore
  messages,
  //@ts-ignore
  input,
  //@ts-ignore
  handleInputChange,
  //@ts-ignore
  handleSubmit,
  //@ts-ignore
  isLoading,
  //@ts-ignore
  requestId,
  //@ts-ignore
  sessionId,
  //@ts-ignore
  leaveBalanceData,
  //@ts-ignore
  identifiedTool,
  //@ts-ignore
  clearChat,
  //@ts-ignore
  ticketCache,
  //@ts-ignore
  ticketCacheTimestamp,
  //@ts-ignore
  append,
}) => {
  const messagesEndRef = useRef(null);
  const [isSuggestionProcessing, setIsSuggestionProcessing] = useState(false);
  const [thinkingText, setThinkingText] = useState(
    "Please wait while I process your request"
  );
  const [localSuggestions, setLocalSuggestions] = useState([]);
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [triggerSubmitAfterSuggestion, setTriggerSubmitAfterSuggestion] =
    useState(false);
  const lastClickedSuggestionRef = useRef<string | null>(null);

  // ⭐ Helper function to extract ticket data
  const extractTicketData = (message: any) => {
    if (!message.toolInvocations) return null;

    const ticketTool = message.toolInvocations.find(
      (tool: any) => tool.toolName === "fetchTicketStatus"
    );

    if (!ticketTool || !ticketTool.result) return null;

    const result = ticketTool.result;

    if (result.status === "SUCCESS" && result.tickets) {
      return result.tickets;
    }

    return null;
  };

  // Start timer when loading begins
  useEffect(() => {
    if (isLoading && !loadingStartTime) {
      //@ts-ignore
      setLoadingStartTime(Date.now());
    } else if (!isLoading) {
      setLoadingStartTime(null);
    }
  }, [isLoading, loadingStartTime]);

  // ⭐ UPDATED: Determine thinking text message based on live model output
  function getThinkingBaseText() {
    // If no messages, this is the initial conversation
    if (!messages || messages.length === 0) {
      return "Please wait while I process your request";
    }

    const lastMessage = messages[messages.length - 1];

    // 1. PRIORITY: Use the model's actual "thinking" text if available
    // This allows the status bar to show "I will search for the relieving letter..."
    if (isLoading && lastMessage?.role === "assistant" && lastMessage?.content) {
      // Clean up the content (remove JSON suggestions, trim whitespace)
      let cleanContent = lastMessage.content
        .replace(/\{["']suggestions["']:[\s\S]*?\}/g, "")
        .trim();

      // HEURISTIC: Use this text only if it looks like a status update
      // (NotEmpty, shorter than a full paragraph, and doesn't look like a final answer)
      if (cleanContent.length > 2 && cleanContent.length < 150) {
        // Strip trailing punctuation for a cleaner "status bar" look
        return cleanContent.replace(/[.,;]+$/, "");
      }
    }

    // 2. FALLBACK: Tool-specific hardcoded messages
    // (Used when the model invokes a tool without saying anything first, or for specific tools)
    if (lastMessage?.toolInvocations?.length > 0) {
      const lastTool =
        lastMessage.toolInvocations[lastMessage.toolInvocations.length - 1];
      const toolName = lastTool.toolName;

      // If tool has a result, we are processing it. Otherwise we are executing it.
      const isPending = !("result" in lastTool);

      if (isPending) {
        switch (toolName) {
          case "executeSearch":
            return "Fetching information from Microland policies";
          case "fetchTicketStatus":
            return "Checking your ticket status";
          case "fetchNDCStatus":
            return "Checking your NDC clearance status";
          case "createTicket":
            return "Preparing ticket creation form";
          case "fetchFullLeaveBalance":
          case "fetchLeaveBalance":
            return "Fetching your leave balance";
          case "applyLeave":
            return "Setting up leave application";
          case "requestPayslip":
          case "requestPFStatement":
          case "requestFormSixteen":
            return "Processing your document request";
          case "currentDateTimeTool":
            return "Checking current date and time";
          default:
            return "Processing your request";
        }
      } else {
        return "Analyzing information";
      }
    }

    // 3. DEFAULT
    return "Please wait while I process your request";
  }

  // Set up thinking animation and check for long response time
  useEffect(() => {
    if (!isLoading) return;

    // Get the dynamic text (either from model or hardcoded fallback)
    let baseText = getThinkingBaseText();

    const checkLoadingTime = () => {
      // If it's taking too long (7s), override with a reassurance message
      // UNLESS we have a specific status from the model (priority)
      if (
        loadingStartTime &&
        Date.now() - loadingStartTime > 7000 &&
        baseText === "Please wait while I process your request"
      ) {
        baseText = "Just a couple more moments";
      }
      return baseText;
    };

    const dots = ["", ".", "..", "..."];
    let i = 0;

    const interval = setInterval(() => {
      const currentBaseText = checkLoadingTime();
      setThinkingText(`${currentBaseText}${dots[i % dots.length]}`);
      i++;
    }, 500);

    return () => clearInterval(interval);
  }, [isLoading, loadingStartTime, messages]); // Re-run when messages change to update the text

  // Extract suggestions from messages
  useEffect(() => {
    if (!messages || messages.length === 0) {
      setLocalSuggestions([]);
      return;
    }

    const extractSuggestions = () => {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || !lastMessage.content) {
        return [];
      }

      try {
        const match = lastMessage.content.match(/\{.*\}/);
        if (match) {
          const parsedData = JSON.parse(match[0]);
          if (parsedData.suggestions && Array.isArray(parsedData.suggestions)) {
            return parsedData.suggestions;
          }
        }
      } catch (error) {
        console.error("Error parsing suggestions:", error);
      }
      return [];
    };

    // Only update suggestions if they've actually changed
    const newSuggestions = extractSuggestions();
    if (JSON.stringify(newSuggestions) !== JSON.stringify(localSuggestions)) {
      setLocalSuggestions(newSuggestions);
    }
  }, [messages]);

  // Handle scrolling
  function scrollToBottom() {
    if (messagesEndRef.current) {
      //@ts-ignore
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages.length]);

  // Reset suggestion processing state
  useEffect(() => {
    if (!isLoading && isSuggestionProcessing) {
      setIsSuggestionProcessing(false);
    }
  }, [isLoading, isSuggestionProcessing]);

  // Handle suggestion clicks
  function handleSuggestionClick(suggestion: string) {
    if (isLoading || isSuggestionProcessing) {
      return;
    }
    setIsSuggestionProcessing(true);

    const syntheticChangeEvent = {
      target: { value: suggestion },
    } as React.ChangeEvent<HTMLInputElement>;
    handleInputChange(syntheticChangeEvent);

    lastClickedSuggestionRef.current = suggestion;
    setTriggerSubmitAfterSuggestion(true);
  }

  useEffect(() => {
    if (
      triggerSubmitAfterSuggestion &&
      input === lastClickedSuggestionRef.current
    ) {
      const syntheticFormEvent = {
        preventDefault: () => {},
      } as React.FormEvent<HTMLFormElement>;
      handleSubmit(syntheticFormEvent);

      setTriggerSubmitAfterSuggestion(false);
      lastClickedSuggestionRef.current = null;
    }
  }, [input, triggerSubmitAfterSuggestion, handleSubmit, handleInputChange]);

  const areSuggestionsDisabled = isLoading || isSuggestionProcessing;

  // Welcome banner component
  const WelcomeBanner = (
    <div
      className="welcome-banner"
      style={{
        textAlign: "center",
        padding: "20px",
        marginBottom: "20px",
      }}
    >
      <img
        src="./ml-mia-chatbot-logo.png"
        alt="MIA Logo"
        style={{
          width: "50px",
          height: "60px",
          margin: "0 auto 16px",
        }}
      />
      <div
        style={{
          color: "#e53e3e",
          fontSize: "1.3rem",
          fontWeight: "bold",
          marginBottom: "8px",
        }}
      >
        {`Hi, I'm MIA,`}
      </div>
      <div style={{ fontSize: "1.20rem", marginBottom: "8px" }}>
        <span style={{ color: "#e53e3e" }}>M</span>
        <span style={{ color: "black" }}>icroland</span>
        <span style={{ color: "#e53e3e" }}> I</span>
        <span style={{ color: "black" }}>ntelligent</span>
        <span style={{ color: "#e53e3e" }}> A</span>
        <span style={{ color: "black" }}>ssistant.</span>
      </div>
      <div style={{ fontSize: "0.9rem", color: "black" }}>
        {`Need Help or Assistance with something? Ask MIA!.`}
      </div>
    </div>
  );

  return (
    <motion.main
      key="chat"
      className="messages-main"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="messages-container">
        <div className="messages-scroll-area">
          <div className="messages-content">
            {WelcomeBanner}

            {/* @ts-ignore */}
            {messages.map((message, index) => {
              const ticketData = extractTicketData(message);
              const hasTickets = ticketData && ticketData.length > 0;

              return (
                <React.Fragment key={index}>
                  {/* If NO tickets, show MessageContainer with built-in feedback */}
                  {!hasTickets && (
                    <MessageContainer
                      message={message}
                      index={index}
                      requestId={requestId}
                      sessionId={sessionId}
                      leaveBalanceData={leaveBalanceData}
                      append={append}
                      onSuggestionClick={handleSuggestionClick}
                      isLoading={isLoading}
                      isLastMessage={index === messages.length - 1}
                    />
                  )}

                  {/* If HAS tickets, show message without feedback, then table + feedback */}
                  {hasTickets && (
                    <>
                      {/* Message text without feedback buttons */}
                      <MessageContainer
                        message={message}
                        index={index}
                        requestId={requestId}
                        sessionId={sessionId}
                        leaveBalanceData={leaveBalanceData}
                        append={append}
                        onSuggestionClick={handleSuggestionClick}
                        isLoading={isLoading}
                        isLastMessage={index === messages.length - 1}
                        hideFeedback={true}
                      />

                      {/* Table + Feedback */}
                      <div className="w-full mb-6">
                        <TicketStatusTable tickets={ticketData} />
                        <FeedbackButtons
                          message={message}
                          index={index}
                          requestId={requestId}
                          sessionId={sessionId}
                        />
                      </div>
                    </>
                  )}
                </React.Fragment>
              );
            })}

            {/* ⭐ STATUS BAR: Shows the dynamic "Thinking..." text */}
            {isLoading && messages.length > 0 && (
              <div className="loading-container">
                <div style={{ fontStyle: "italic", color: "#4B5563" }}>
                  {thinkingText}
                </div>
              </div>
            )}

            {localSuggestions.length > 0 && (
              <div className="suggestions-wrapper">
                {localSuggestions.map((suggestion, index) => (
                  <button
                    key={`suggestion-${index}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`suggestion-button ${
                      areSuggestionsDisabled ? "disabled" : ""
                    }`}
                    disabled={areSuggestionsDisabled}
                    style={{
                      opacity: areSuggestionsDisabled ? 0.6 : 1,
                      cursor: areSuggestionsDisabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <div className="input-wrapper">
        <AIInput
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          clearChat={clearChat}
        />
      </div>
    </motion.main>
  );
};

// Add display name for better debugging
Messages.displayName = "Messages";

export default Messages;