import { useSidebar } from "./ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { Menu } from "lucide-react";

export function SidebarToggle() {
    const { toggleSidebar, state } = useSidebar();
    const isOpen = state === "expanded";

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={toggleSidebar}
                    className="p-2 rounded-full hover:bg-neutral-800 text-[var(--color-text-light)] transition-colors"
                    aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
                >
                    <Menu size={20} />
                </button>
            </TooltipTrigger>
            <TooltipContent
                align="end"
                className="bg-neutral-800 text-[var(--color-text-light)] border-neutral-700"
            >
                Toggle Sidebar
            </TooltipContent>
        </Tooltip>
    );
}