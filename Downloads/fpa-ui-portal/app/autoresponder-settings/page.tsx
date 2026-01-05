// import necessary modules and components
import { redirect } from "next/navigation";
import ViewAutoresponderSettings from "@/components/autoresponderComponents/ViewAutoresponderSettings";
import { getCurrentSession } from "@/lib/session";

// Main page component for Autoresponder Settings
export default async function Home() {
  // get the session to check if the user is authenticated
  const session = await getCurrentSession();

  // if not authenticated, redirect to the login page
  if (!session) {
    redirect("/");
  }
  return (
    <div>
      <ViewAutoresponderSettings />
    </div>
  );
}
