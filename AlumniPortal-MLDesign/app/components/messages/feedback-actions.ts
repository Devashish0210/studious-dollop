"use server";

import { getFeedbackLogger } from "@/lib/logger-factory";

/**
 * Handles the Thumbs Up / Thumbs Down feedback for a specific message.
 * Maps 'like'/'dislike' to the boolean required by the strict logger schema.
 */
export async function submitMessageFeedback(
  sessionId: string,
  requestId: string,
  type: "like" | "dislike"
) {
  // console.log(`[FeedbackAction] 🟢 Starting Message Feedback. Session: ${sessionId}, Request: ${requestId}, Type: ${type}`);
  try {
    // The factory automatically resolves the UserID from cookies
    const logger = await getFeedbackLogger();
    
    // Map UI types to Logger types (boolean)
    const isHelpful = type === "like";
    // console.log(`[FeedbackAction] Type: "${type}" | Calculated isHelpful: ${isHelpful}`);

    await logger.SendMessageFeedback({
      chatId: sessionId, // In this context, the session ID is the Chat ID
      messageId: requestId,
      feedback: isHelpful,
    });
    // console.log(`[FeedbackAction] ✅ Message Feedback submitted successfully.`);

    return { success: true };
  } catch (error) {
    console.error("[FeedbackAction] Failed to submit message feedback:", error);
    // Return a safe error object to the client
    return { success: false, error: "Failed to process feedback." };
  }
}

/**
 * Handles the 5-star rating and comment for the overall chat session.
 */
export async function submitChatFeedback(
  sessionId: string,
  rating: number,
  comment: string
) {
  // console.log(`[FeedbackAction] 🔵 Starting Chat Feedback. Session: ${sessionId}, Rating: ${rating}`);
  try {
    const logger = await getFeedbackLogger();

    await logger.SendChatFeedback({
      chatId: sessionId,
      rating: rating,
      comment: comment || "", // Ensure string, never null/undefined
    });
    // console.log(`[FeedbackAction] ✅ Chat Feedback submitted successfully.`);

    return { success: true };
  } catch (error) {
    console.error("[FeedbackAction] Failed to submit chat feedback:", error);
    return { success: false, error: "Failed to process feedback." };
  }
}