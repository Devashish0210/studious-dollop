// file: fpa-ui-portal/components/chat/GlobalTemplates.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { fetchGlobalSQLTemplates } from "@/lib/api";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Database } from "lucide-react"; // Using a different icon to distinguish from Sparkles
import { v4 as uuidv4 } from "uuid";

interface GlobalTemplate {
  id: string;
  visible_text: string;
  description?: string;
  sql: string;
}

interface GlobalTemplatesProps {
  onQuerySelect?: (text: string) => void;
}

export function GlobalTemplates({ onQuerySelect }: GlobalTemplatesProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [templates, setTemplates] = useState<GlobalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      const token = (session as any)?.user?.accessToken;
      
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await fetchGlobalSQLTemplates(token);
        setTemplates(data || []);
      } catch (err) {
        console.error("Error loading templates:", err);
        setError("Could not load templates.");
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      loadTemplates();
    }
  }, [session]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl mt-8">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || templates.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mt-8 space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground ml-1 flex items-center gap-2">
        <Database className="w-4 h-4 text-blue-500" />
        Sample Data Templates
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card 
            key={template.id} 
            className="cursor-pointer hover:bg-muted/50 transition-colors border-dashed border-blue-800/30"
            // Use template_text or name as the visible text to put in chat
            onClick={() => {
              if (onQuerySelect) {
                onQuerySelect(template.visible_text);
              } else {
                const tempId = `temp_${uuidv4()}`;
                router.push(`/chat/${tempId}?templateId=${template.id}&text=${encodeURIComponent(template.visible_text)}`);
              }
            }}
          >
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-medium">
                {template.visible_text}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <CardDescription className="line-clamp-2 text-xs">
                {template.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}