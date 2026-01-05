"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import { House, PlusCircle, SquareArrowOutUpRight, Database } from "lucide-react";
import { SidebarUserProfile } from "./SidebarUserProfile";
import { FullScreenLoader } from "./FullScreenLoader";
import { SidebarChatHistory } from "./SidebarChatHistory";
import { SidebarToggle } from "./SiderbarToggle";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const [isPending, startTransition] = React.useTransition();
  const pathname = usePathname();

  const handleNavigation = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <>
      {isPending && <FullScreenLoader />}
      <Sidebar collapsible="icon" className="border-r border-neutral-800 bg-[var(--color-bg-dark)] text-[var(--color-text-light)]" {...props}>
        <SidebarHeader className="h-16 flex flex-row items-center justify-start border-neutral-800/50">
        <SidebarToggle />
           
        </SidebarHeader>

        <SidebarContent>
          {/* Main Actions Group */}
          <SidebarGroup>
            <SidebarMenu>
              {/* New Chat Button - Refactored to SidebarMenuButton for proper collapse behavior */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleNavigation("/")}
                  tooltip="New Chat"
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 group-data-[collapsible=icon]:bg-transparent"
                >
                  <PlusCircle />
                  <span >New Chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Home Link
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Home">
                  <Link href="https://www.microland.com/">
                    <House />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem> */}

              {/* Global SQL Link */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleNavigation("/globalsql")}
                  tooltip="Global SQL"
                >
                  <Database />
                  <span>Global SQL</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Dashboards Link */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Dashboards">
                  <Link href="https://ai.microland.com/copilot/insights/fusion/dashboards">
                    <SquareArrowOutUpRight />
                    <span>Dashboards</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          {/* Recent Chats Group - Automatically hidden via CSS when collapsed if desired, or we rely on SidebarChatHistory structure */}
          <SidebarGroup className="mt-4 group-data-[collapsible=icon]:hidden">
             <SidebarGroupLabel>Recent Chats</SidebarGroupLabel>
             <SidebarGroupContent>
                <SidebarChatHistory
                  currentPath={pathname}
                  setOpenMobile={setOpenMobile}
                />
             </SidebarGroupContent>
          </SidebarGroup>

        </SidebarContent>

        <SidebarFooter>
          <SidebarUserProfile handleNavigation={handleNavigation} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </>
  );
}