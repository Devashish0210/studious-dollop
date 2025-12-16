"use client";
import React from "react";
import { Markdown } from "../ui/markdown";
import { ToolInvocations } from "./tool-invocations";

export const Message = ({ message, leaveBalanceData, append }) => {
  // User message handling
  if (message.role === "user") {
    return <div className="user-message">{message.content}</div>;
  }

  // =================================================================================
  // 1. SPECIAL HANDLING: applyLeave
  // If it's an applyLeave tool, we strictly show ONLY the tool UI (as per original logic)
  // =================================================================================
  const hasToolInvocations =
    message.parts &&
    message.parts.some((part) => part.type === "tool-invocation");

  const hasApplyLeaveTool =
    (hasToolInvocations &&
      message.parts.some(
        (part) =>
          part.type === "tool-invocation" &&
          part.toolInvocation &&
          part.toolInvocation.toolName === "applyLeave"
      )) ||
    (message.toolInvocations &&
      message.toolInvocations.some((tool) => tool.toolName === "applyLeave"));

  if (hasApplyLeaveTool) {
    if (message.parts && message.parts.length > 0) {
      const toolInvocationParts = message.parts.filter(
        (part) => part.type === "tool-invocation" && part.toolInvocation
      );
      return (
        <>
          {toolInvocationParts.map((part, index) => (
            <ToolInvocations
              key={`tool-${index}`}
              toolInvocations={[part.toolInvocation]}
              leaveBalanceData={leaveBalanceData}
              onTicketCreated={append}
            />
          ))}
        </>
      );
    } else if (message.toolInvocations) {
      return (
        <ToolInvocations
          toolInvocations={message.toolInvocations}
          leaveBalanceData={leaveBalanceData}
          onTicketCreated={append}
        />
      );
    }
  }

  // =================================================================================
  // 2. GENERAL HANDLING: Multi-step Messages (Text -> Tool -> Text)
  // We iterate through parts to selectively hide "Thinking..." text
  // =================================================================================
  if (message.parts && message.parts.length > 0) {
    return (
      <>
        {message.parts.map((part, index) => {
          // --- Handle Tool Invocations ---
          if (part.type === "tool-invocation") {
            return (
              <ToolInvocations
                key={`tool-${index}`}
                toolInvocations={[part.toolInvocation]}
                leaveBalanceData={leaveBalanceData}
                onTicketCreated={append}
              />
            );
          }

          // --- Handle Text ---
          if (part.type === "text" && part.text) {
            // INTELLIGENT HIDING:
            // Check if this text is immediately followed by a tool invocation.
            // If yes, it's likely "I will check..." or "I need to search..." -> HIDE IT.
            const nextPart = message.parts[index + 1];
            if (nextPart && nextPart.type === "tool-invocation") {
              return null; // 🛑 Hide this part
            }

            // CLEANUP: Remove suggestions JSON from the final text
            let content = part.text;
            try {
              const jsonMatch = content.match(/\{["']suggestions["']:.*\}/s);
              if (jsonMatch) {
                content = content.replace(jsonMatch[0], "").trim();
              }
              // Clean trailing whitespace
              content = content.replace(/\s+$/, "");
            } catch (error) {
              console.error("Error cleaning part text:", error);
            }

            if (!content) return null;

            // ✅ Show this part (The Final Answer)
            return <Markdown key={`text-${index}`} content={content} />;
          }

          return null;
        })}
      </>
    );
  }

  // =================================================================================
  // 3. FALLBACK: Simple Text Messages (No parts)
  // =================================================================================
  let cleanedMessageContent = message.content;
  try {
    const jsonMatch = message.content.match(/\{["']suggestions["']:.*\}/s);
    if (jsonMatch) {
      cleanedMessageContent = message.content.replace(jsonMatch[0], "").trim();
    }
    cleanedMessageContent = cleanedMessageContent.replace(/\s+$/, "");
  } catch (error) {
    console.error("Error processing message content:", error);
  }

  return <Markdown content={cleanedMessageContent} />;
};