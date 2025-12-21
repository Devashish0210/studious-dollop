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
                    "border-r border-neutral-800 scrollbar-hide",
                    "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                    "text-[var(--color-text-dark)]",
                    !isOpen && "hidden md:block"
                )}>
                <SidebarHeader className="border-b border-neutral-800 flex items-center justify-between px-2 py-2">
                    {/* <SidebarUserProfile /> */}
                </SidebarHeader>
                <SidebarContent className="px-2 scrollbar-hide">
                    <SidebarMenu className="flex flex-col gap-4 mt-2">
                        <Link
                            href="https://www.microland.com/"
                            className={cn(
                                "flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg transition-all group",
                                "hover:text-[var(--color-text-highlight)]",
                                "text-[var(--color-text-dark)]",
                            )}
                        >
                            <House className="h-5 w-5" />
                            <span className="text-sm font-medium">Vist Us</span>
                        </Link>
                        <Link
                            href="https://ai.microland.com/copilot/insights/fusion/dashboards"
                            onClick={() => handleNavigation("https://ai.microland.com/copilot/insights/fusion/dashboards")}
                            className={cn(
                                "flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg transition-all group",
                                "hover:text-[var(--color-text-highlight)]",
                                "text-[var(--color-text-dark)]",
                            )}
                        >
                            <SquareArrowOutUpRight className="h-5 w-5" />
                            <span className="text-sm font-medium">Dashboards</span>
                        </Link>
                        <div className="my-[6.95px] px-2 py-2 border-t border-neutral-800">
                            <Button
                                onClick={() => handleNavigation("/")}
                                variant="outline"
                                className={cn(
                                    "w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all group",
                                    "text-[var(--color-text-dark)]",
                                    "hover:bg-[var(--color-button-highlight)]",
                                    "hover:text-[var(--color-text-highlight)]"
                                )}
                            >
                                <PlusCircle className="h-4 w-4" />
                                <span className="text-sm font-medium">New Chat</span>
                            </Button>

                            <SidebarChatHistory
                                currentPath={pathname}
                                setOpenMobile={setOpenMobile}
                            />
                        </div>
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter className="border-t border-neutral-800 px-2 py-2">
                    <SidebarUserProfile handleNavigation={handleNavigation} />
                </SidebarFooter>
            </Sidebar>
        </>
    );
}