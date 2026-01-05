// import necessary modules and components
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

// Main page component for Fine-tuning
export default async function Home() {
  // get the session to check if the user is authenticated
  const session = await getCurrentSession();

  // if not authenticated, redirect to the login page
  if (!session) {
    redirect("/");
  }

  return (
    <div>
      <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
        <span>Welcome to Fine-tuning Page</span>
      </h1>
      <div className="flex items-center justify-center items-center gap-2 mt-15">
        <p>
          We appreciate your patience. This feature will be available in the
          next version.
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 mt-2">
        <p>Thank you.</p>
      </div>
    </div>
  );
}
