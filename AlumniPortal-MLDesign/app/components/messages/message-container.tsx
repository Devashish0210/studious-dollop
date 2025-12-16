import { useState } from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { Message } from "./message";
import { FeedbackButtons } from "./FeedbackButtons";
import "../../../app/globals.css";

interface MessageContainerProps {
  message: any;
  index: number;
  isLastMessage?: boolean;
  requestId: string;
  sessionId: string;
  isLoading?: boolean;
  onSuggestionClick?: (suggestion: string) => void;
  leaveBalanceData: string;
  hideFeedback?: boolean;
  append?: any;
}

export const MessageContainer = ({
  message,
  index,
  isLastMessage,
  requestId,
  sessionId,
  isLoading,
  onSuggestionClick,
  leaveBalanceData,
  hideFeedback = false,
  append,
}: MessageContainerProps) => {
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(
    null
  );

  // Remove suggestions JSON from the message content
  let cleanedMessageContent = message.content;
  try {
    const match = message.content.match(/\{.*\}/); // Find JSON-like content
    if (match) {
      cleanedMessageContent = message.content.replace(match[0], "").trim(); // Remove it
    }
  } catch (error) {
    console.error("Error processing message content:", error);
  }

  // Parse suggestions from message content if they exist
  const suggestions = message.suggestions || [];

  const handleSuggestionClick = (suggestion: string) => {
    if (isLoading) return; // Prevent action if globally loading
    setSelectedSuggestion(suggestion); // For local styling of the clicked button
    if (onSuggestionClick) {
      onSuggestionClick(suggestion); // Call the handler passed from Messages.tsx
    }
  };

  // Determine message positioning classes
  const isAssistant = message.role === "assistant";

  // Avatar component
  const Avatar = ({ isUser = false }) => {
    if (isUser) {
      return (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
          <User size={20} className="text-gray-500" />
        </div>
      );
    } else {
      return (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <img src="./ml-mia-chatbot-logo.png" alt="Assistant" />
        </div>
      );
    }
  };

  return (
    <div className="message-wrapper">
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 100 }}
        className={`message-container ${isAssistant ? "assistant" : "user"}`}
      >
        {/* Message with avatar on appropriate side */}
        <div
          className={`flex items-start gap-3 w-full ${
            isAssistant ? "" : "flex-row-reverse"
          }`}
        >
          {/* Avatar - will be on left for assistant, right for user */}
          <div className="flex-shrink-0">
            <Avatar isUser={!isAssistant} />
          </div>

          {/* Message Content */}
          <div
            className={`flex flex-col ${
              isAssistant ? "items-start" : "items-end"
            } flex-grow`}
          >
            <div
              className={`message-text ${
                isAssistant ? "assistant-text" : "user-text"
              }`}
              style={{
                backgroundColor: isAssistant ? "#ffffff" : "#f1f1f1",
                borderRadius: "12px",
                padding: "12px 15px",
                maxWidth: "100%",
                wordWrap: "break-word",
              }}
            >
              {isAssistant ? (
                <Message
                  message={{ ...message, content: cleanedMessageContent }}
                  leaveBalanceData={leaveBalanceData}
                  append={append}
                />
              ) : (
                message.content
              )}
            </div>

            {/* Only show suggestions and feedback for assistant messages */}
            {isAssistant && (
              <>
                {/* Follow-up Questions */}
                {suggestions.length > 0 && (
                  <div className="suggestions-container mt-2 flex flex-wrap">
                    {suggestions.map((suggestion: string, idx: number) => (
                      <motion.button
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`suggestion-button ${
                          selectedSuggestion === suggestion ? "selected" : ""
                        }`}
                        disabled={isLoading}
                      >
                        {suggestion}
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* ⭐ Feedback Section - Only show if NOT hidden */}
                {!hideFeedback && (
                  <FeedbackButtons
                    message={message}
                    index={index}
                    requestId={message.id}
                    sessionId={sessionId}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>

      {!isLastMessage && <hr className="message-divider" />}
    </div>
  );
};

export default MessageContainer;