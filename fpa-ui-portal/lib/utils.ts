import { generateText, Message } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { azure } from "./aoi";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateUUID() {
  const hex = [...Array(24)]
    .map(() => Math.floor(Math.random() * 16).toString(16))
    .join("");
  return hex;
}

// export function generateUUID() {
//   return crypto.randomUUID
//     ? crypto.randomUUID()
//     : Math.random().toString(36).substring(2, 15);
// }

export async function generateTitleFromUserMessage({
  message,
}: {
  message: Message;
}) {
  const { text: title } = await generateText({
    model: azure(process.env.AZURE_OPENAI_DEPLOYMENT_NAME!),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}
