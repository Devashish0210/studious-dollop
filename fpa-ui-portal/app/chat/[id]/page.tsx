// Import necessary modules and components
import { redirect } from "next/navigation";
import Chat from "@/components/chatComponents/Chat";
import { getCurrentSession } from "@/lib/session";
import { getChatById } from "@/lib/api";

// Main page component for Chat
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  // Await params to get the actual values
  const { id } = await params;

  // get the session to check if the user is authenticated
  const session = await getCurrentSession();

  // if not authenticated, redirect to the login page
  if (!session) redirect("/");

  const accessToken = (session as any)?.user?.accessToken;
  let chatData = { messages: [] };
  try {
    // Fetch chat messages by chatId
    chatData = await getChatById(session?.user?.id, id, accessToken);
  } catch (error) {
    console.error("Failed to fetch chat by ID:", error);
    chatData = { messages: [] };
  }

  return (
    <div>
      <Chat initialChatId={id} initialMessages={chatData?.messages || []} />
    </div>
  );
}
