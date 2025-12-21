"use client";

// Import necessary modules and components
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    useSidebar,
} from '@/components/ui/sidebar';
import { House, PlusCircle, SquareArrowOutUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SidebarUserProfile } from "./SidebarUserProfile";
import { FullScreenLoader } from "./FullScreenLoader";
import "../app/globals.css";
import { DropdownMenuSeparator } from "./ui/dropdown-menu";
import Link from "next/link";
import { SidebarChatHistory } from "./SidebarChatHistory";

interface Chat {
    id: string;
    title: string;
    createdAt: Date;
}

export function AppSidebar() {
    const router = useRouter();
    const { setOpenMobile, state } = useSidebar();
    const [isPending, startTransition] = React.useTransition();
    const pathname = usePathname();

    const isOpen = state === "expanded";

    const handleNavigation = (href: string) => {
        startTransition(() => {
            router.push(href);
        });
    };

    const handleNewChat = () => {
        startTransition(() => {
            router.push("/");
        });
    };

    return (
        <>
            {isPending && <FullScreenLoader />}
            <Sidebar
                className={cn(
                    "border-r border-neutral-800 scrollbar-hide bg-[var(--color-bg-dark)] text-[var(--color-text-light)]",
                )}>
                <SidebarHeader className="border-neutral-800 flex items-center justify-between px-2 py-2">
                    {/* <SidebarUserProfile /> */}
                </SidebarHeader>
                <SidebarContent className="px-2 scrollbar-hide">
                    <SidebarMenu className="flex flex-col gap-2 mt-2">

                               <div className={cn("mb-4", !isOpen && "flex justify-center")}>
        <Button
          onClick={() => handleNavigation("/")}
          className={cn(
            "rounded-full transition-all group",
            isOpen 
              ? "w-full justify-start px-4 py-6 bg-neutral-800 text-neutral-300 hover:bg-neutral-700" 
              : "w-10 h-10 p-0 bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center"
          )}
        >
          <PlusCircle className={cn("h-5 w-5", isOpen && "mr-3")} />
          {isOpen && <span className="text-sm font-medium">New Chat</span>}
        </Button>
      </div>
      

                        <Link
                            href="https://www.microland.com/"
                            className={cn(
                                "flex items-center gap-4 px-4 py-3 text-sm font-medium rounded-full transition-all group",
                                "hover:bg-neutral-800 text-neutral-300",
                                !isOpen && "justify-center px-2"
                            )}
                        >
                            <House className="h-5 w-5" />
                            {isOpen && <span>Home</span>}
                        </Link>
                        <Link
                            href="https://ai.microland.com/copilot/insights/fusion/dashboards"
                            onClick={() => handleNavigation("https://ai.microland.com/copilot/insights/fusion/dashboards")}
                            className={cn(
                                "flex items-center gap-4 px-4 py-3 text-sm font-medium rounded-full transition-all group",
                                "hover:bg-neutral-800 text-neutral-300",
                                !isOpen && "justify-center px-2"
                            )}
                        >
                            <SquareArrowOutUpRight className="h-5 w-5" />
                            {isOpen && <span>Dashboards</span>}
                        </Link>
                        {isOpen && (
        <div className="mt-4 px-4">
          <SidebarChatHistory
            currentPath={pathname}
            setOpenMobile={setOpenMobile}
          />
        </div>
      )}
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter className="px-2 py-4">
                    <SidebarUserProfile handleNavigation={handleNavigation} />
                </SidebarFooter>
            </Sidebar>
        </>
    );
}