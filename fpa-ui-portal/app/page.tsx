// Import necessary modules and components
import { redirect } from "next/navigation";
import LoginComponent from "@/components/LoginComponent";
import { getCurrentSession } from "@/lib/session";
import { generateUUID } from '@/lib/utils';

// Main page component
export default async function Home() {
  // Get session on the server side
  const session = await getCurrentSession();
  const chatId = generateUUID();

  return (
    <>
      {/* If the user is not authenticated, show the login component */}
      {!session ? (
        <LoginComponent />
      ) : (
        // If the user is authenticated, redirect to the chat page
        redirect(`/chat/${chatId}`)
      )}
    </>
  );
}
