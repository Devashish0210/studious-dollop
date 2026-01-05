import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { GlobalTemplates } from "@/components/chatComponents/GlobalTemplates";

export default async function GlobalSQLPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Global SQL Templates</h1>
        <p className="text-muted-foreground">
          Browse and select from curated SQL templates for your data analysis.
        </p>
      </div>
      
      <div className="flex justify-center">
        <GlobalTemplates />
    </div>
    </div>
  );
}