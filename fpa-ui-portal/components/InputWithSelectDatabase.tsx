"use client";

import { ChangeEvent, FormEvent, useEffect } from "react";
import { Send } from "lucide-react";
import { type UseChatHelpers } from "@ai-sdk/react";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import "../app/globals.css";

const MIN_HEIGHT = 132;
const MAX_HEIGHT = 264;

interface AIInputProps {
    input: string;
    handleInputChange: (
        e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>
    ) => void;
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void; placeholder?: string;
    isLoading?: boolean;
    className?: string;
    databases?: any[];
    selectedDatabaseId?: string | null;
    setSelectedDatabaseId: (value: string) => void;
    dbLoading?: boolean;
}

export const AIInput = ({
    input,
    handleInputChange,
    handleSubmit,
    placeholder = "Ask any question related to your data present in database...",
    isLoading = false,
    className,
    databases = [],
    selectedDatabaseId,
    setSelectedDatabaseId,
    dbLoading = false,
}: AIInputProps) => {
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: MIN_HEIGHT,
        maxHeight: MAX_HEIGHT,
    });

    useEffect(() => {
        adjustHeight();
    }, [input, adjustHeight]);

    const onSubmit = (e?: FormEvent) => {
        e?.preventDefault();
        handleSubmit(e as any);
        adjustHeight(true);
    };

    return (
        <div className={cn("w-full py-2 sm:py-4 px-2 sm:px-0", className)}>
            <div className="relative w-full mx-auto">
                {/* Input Field for the user to Chat */}
                <form
                    onSubmit={onSubmit}
                    className="relative flex flex-col"
                >
                    {/* Textarea */}
                    <div className="relative">
                        <Textarea
                            value={input}
                            placeholder={placeholder}
                            className={cn("w-full rounded-xl px-4 py-3 pr-24 bg-white/5 border-none text-[var(--color-text-dark)] placeholder:text-white/70 resize-none focus-visible:ring-0 leading-[1.2]")}
                            ref={textareaRef}
                            onChange={(e) => {
                                handleInputChange(e);
                                adjustHeight();
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    if (!isLoading) onSubmit();
                                    adjustHeight(true);
                                }
                            }}
                            disabled={isLoading}
                        />

                        {/* Inline Select inside textarea area (bottom-left) */}
                        <div className="absolute left-3 bottom-3 z-10">
                            <Select
                                value={selectedDatabaseId ?? ""}
                                onValueChange={setSelectedDatabaseId}
                                disabled={dbLoading || databases.length === 0}
                            >
                                <SelectTrigger
                                    className={cn(
                                        "w-40 h-8 border text-xs font-semibold transition",
                                        "border-neutral-300 dark:border-neutral-700",
                                        "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                                        "text-[var(--color-text-dark)]",
                                        "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]",
                                        "focus:ring-2 focus:ring-[var(--color-text-highlight)]"
                                    )}
                                >
                                    <SelectValue
                                        placeholder={dbLoading ? "Loading..." : "Database"}
                                    />
                                </SelectTrigger>
                                <SelectContent
                                    className={cn(
                                        "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                                        "border border-neutral-300 dark:border-neutral-700"
                                    )}
                                >
                                    {databases?.map((db: any) => (
                                        <SelectItem
                                            key={db?.db_connection_id}
                                            value={db?.db_connection_id}
                                            className={cn(
                                                "text-[var(--color-text-dark)]",
                                                "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
                                            )}
                                        >
                                            {db?.db_connection_alias || db?.db_connection_id}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Send button in bottom-right corner */}
                        <Button
                            type="submit"
                            disabled={input.trim() === "" || isLoading}
                            className={cn(
                                "absolute right-3 bottom-3 h-8 w-16 p-0 transition-all",
                                "bg-neutral-700 dark:bg-neutral-600",
                                "hover:bg-neutral-600 dark:hover:bg-neutral-500"
                            )}
                        >
                            {isLoading ? (
                                <span className="text-xs">Thinking...</span>
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};