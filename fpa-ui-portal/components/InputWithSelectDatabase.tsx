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
                   <div className="relative rounded-xl bg-neutral-800 border border-neutral-700 focus-within:ring-2 focus-within:ring-[var(--color-text-highlight)] overflow-hidden">
                        <Textarea
                            value={input}
                            placeholder={placeholder}
                            className={cn(
                "w-full min-h-[60px] max-h-[200px] px-4 py-3 pb-12 bg-transparent border-none text-[var(--color-text-light)] placeholder:text-neutral-500 resize-none focus-visible:ring-0 leading-relaxed"
              )}
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
                                        "h-8 border-none text-xs font-medium transition-colors bg-neutral-700/50 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 rounded-lg px-3 gap-2"
                                    )}
                                >
                                    <SelectValue
                                        placeholder={dbLoading ? "Loading..." : "Database"}
                                    />
                                </SelectTrigger>
                                <SelectContent
                                    className={cn(
                                        "bg-neutral-800 border-neutral-700 text-neutral-200"
                                    )}
                                >
                                    {databases?.map((db: any) => (
                                        <SelectItem
                                            key={db?.db_connection_id}
                                            value={db?.db_connection_id}
                                            className={cn(
                                                "focus:bg-neutral-700 focus:text-neutral-100 cursor-pointer"
                                            )}
                                        >
                                            {db?.db_connection_alias || db?.db_connection_id}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Send button in bottom-right corner */}
                        {input.trim() !== "" && (
                        <Button
                            type="submit"
                            disabled={input.trim() === "" || isLoading}
                            className={cn(
                                "absolute right-3 bottom-3 h-8 w-8 p-0 rounded-lg transition-all",
                "bg-[var(--color-text-highlight)] hover:bg-[var(--color-text-highlight)]/90 text-white"
                            )}
                        >
                            {isLoading ? (
                                <span className="text-xs">Thinking...</span>
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};