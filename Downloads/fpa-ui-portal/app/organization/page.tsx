// import necessary modules and components
import { redirect } from "next/navigation";
import ViewOrganization from "@/components/organizationComponents/ViewOrganization";
import { getCurrentSession } from "@/lib/session";

// Main page component for Organization
export default async function Home() {
  // get the session to check if the user is authenticated
  const session = await getCurrentSession();

  // if not authenticated, redirect to the login page
  if (!session) {
    redirect("/");
  }

  return (
    <div className="m-4">
      <ViewOrganization />
    </div>
  );
}
