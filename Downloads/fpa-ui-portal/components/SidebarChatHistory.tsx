import Link from "next/link";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";
import { MessageSquare } from "lucide-react";
import React, { useEffect, useState } from "react";
import { getUserChats } from "@/lib/api";
import { useSession } from "next-auth/react";

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function SidebarChatHistory({
  currentPath,
  setOpenMobile,
}: {
  currentPath: string;
  setOpenMobile: (open: boolean) => void;
}) {
  const { data: session } = useSession();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChats() {
      const userId = (session as any)?.user?.id;
      const accessToken = (session as any)?.user?.accessToken;
      if (userId && accessToken) {
        try {
          const data = await getUserChats(userId, accessToken);
          const list = Array.isArray(data?.chats) ? data?.chats?.slice() : [];
          list.sort((a: any, b: any) => {
            const ta = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
            const tb = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
            return tb - ta;
          });

          setChats(list);
        } catch (error) {
          console.error("Failed to fetch user chats:", error);
          setChats([]);
        }
      }
      setLoading(false);
    }
    fetchChats();
  }, [session]);

  if (loading) {
    return <ChatListSkeleton />;
  }

  if (chats.length === 0) {
    return <div className="px-4 text-xs text-muted-foreground">No chats yet</div>;
  }

  return (
    <SidebarMenu>
      {chats.map((chat) => (
        <SidebarMenuItem key={chat.id}>
          <SidebarMenuButton
            asChild
            isActive={currentPath === `/chat/${chat.id}`}
            className="group/item flex items-center gap-3 px-3 py-2 text-sm rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <Link
              href={`/chat/${chat.id}`}
              onClick={() => setOpenMobile(false)}
              className="flex items-center w-full overflow-hidden"
            >
              <MessageSquare className="h-4 w-4 mr-3 shrink-0" />
              <span className="truncate">{chat.title || "New conversation"}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function ChatListSkeleton() {
  const widths = [30, 75, 45, 65, 50];
  return (
    <div className="space-y-1 px-1">
      {[1, 2, 3, 4, 5].map((i, index) => (
        <div key={i} className="animate-pulse flex items-center gap-2 px-2 py-1 rounded-md h-8">
          <div className="h-4 w-4 rounded-full bg-neutral-800 shrink-0" />
          <div className="h-4 rounded bg-neutral-800" style={{ width: `${widths[index]}%` }} />
        </div>
      ))}
    </div>
  );
}