"use client";

// Import necessary modules and components
import React, { useState } from "react";
import {
    LogOut,
    UserIcon,
    MessageSquare as ChatIcon,
    Database as DatabasesIcon,
    Search as QueriesIcon,
    Building2 as OrganizationIcon,
    Settings as SettingsIcon,
    Star as GoldenSQLIcon
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "./ui/sidebar";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const navigationItems = [
    // { href: "/", icon: HomeIcon, label: "Dashboards" },
    // { href: "/chat", icon: ChatIcon, label: "Chat" },
    { href: "/databases", icon: DatabasesIcon, label: "Databases" },
    { href: "/queries", icon: QueriesIcon, label: "Queries" },
    // { href: "/golden-sql", icon: GoldenSQLIcon, label: "Golden-SQL" },
    { href: "/organization", icon: OrganizationIcon, label: "Organization" },
    // {
    //     href: "/autoresponder-settings",
    //     icon: SettingsIcon,
    //     label: "Autoresponder Settings",
    // },
];

interface SidebarUserProfileProps {
    handleNavigation: (href: string) => void;
}

export function SidebarUserProfile({ handleNavigation }: SidebarUserProfileProps) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const user = session?.user;
    const [open, setOpen] = useState(false);
    const { state } = useSidebar();
    const isOpen = state === "expanded";

    const handleItemClick = (href: string) => {
        handleNavigation(href);
        setOpen(false);
    };

    const handleLogout = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        setOpen(false);
        signOut({ callbackUrl: "/" });
    };

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu open={open} onOpenChange={setOpen}>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            className={cn(
                                "transition-all duration-200 group h-12 rounded-full hover:bg-neutral-800",
                                !isOpen && "justify-center w-10 h-10 p-0"
                            )}
                        >
                            <div className={cn("flex items-center gap-3", !isOpen && "justify-center")}>
                                {user?.image ? (
                                    <Image
                                        src={user.image}
                                        className="h-8 w-8 shrink-0 rounded-full"
                                        width={24}
                                        height={24}
                                        alt="Avatar"
                                    />
                                ) : (
                                    <UserIcon className="h-6 w-6 text-neutral-400 transition-colors" />
                                )}
                                {isOpen && (
        <div className="flex flex-col text-left">
          <span className="text-sm font-medium text-neutral-200 truncate max-w-[150px]">{user?.name || "User"}</span>
        </div>
      )}
                            </div>
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        side="top"
                        align="center"
                        sideOffset={4}
                        className="w-56 border-neutral-700 bg-neutral-900 text-neutral-200"
                    >
                        {navigationItems.map((item) => {
                            const active = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => handleItemClick(item.href)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg transition-all group",
                                        "hover:bg-neutral-800",
                                        active
                                            ? "bg-neutral-800 text-white"
                                            : "text-neutral-400",
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    <span className="text-sm font-medium">{item.label}</span>
                                </Link>
                            );
                        })}
                        <DropdownMenuSeparator className="bg-neutral-700" />
                        <Link
                            href="#"
                            onClick={handleLogout}
                            className={cn(
                                "flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-lg transition-all group hover:bg-neutral-800 text-neutral-400 hover:text-white",
                            )}
                        >
                            <LogOut className="h-5 w-5" />
                            <span className="text-sm font-medium">Logout</span>
                        </Link>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
