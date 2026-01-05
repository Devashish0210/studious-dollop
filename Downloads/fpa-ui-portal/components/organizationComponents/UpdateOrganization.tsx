"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { updateOrganization } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import "../../app/globals.css";

// UpdateOrganization component props interface
interface UpdateOrganizationProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  type: "name" | "apiKey";
  orgId: string;
  token: string | null;
  currentValue?: string;
  organizationName?: string;
}

// UpdateOrganization component
export default function UpdateOrganization({
  isOpen,
  onClose,
  onSuccess,
  type,
  orgId,
  token,
  currentValue = "",
  organizationName = "",
}: UpdateOrganizationProps) {
  const [newValue, setNewValue] = useState(currentValue);
  const [isUpdating, setIsUpdating] = useState(false);

  // Function to handle save action
  const handleSave = async () => {
    if (!token || !orgId || !newValue.trim()) {
      return;
    }

    try {
      setIsUpdating(true);

      // Prepare payload based on update type
      const payload =
        type === "name"
          ? { name: newValue.trim() }
          : { llmApiKey: newValue.trim() };

      const result = await updateOrganization(token, orgId, payload);

      // Handle success or failure
      if (result) {
        toast(
          `Organization ${type === "name" ? "name" : "API key"
          } updated successfully`
        );
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      } else {
        toast(
          `Failed to update organization ${type === "name" ? "name" : "API key"
          }`
        );
      }
    } catch (error) {
      console.error(`Error updating organization ${type}:`, error);
      toast(
        `Error updating organization ${type === "name" ? "name" : "API key"}`
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // Function to get title based on type
  const getTitle = () => {
    return type === "name" ? "Edit Organization Name" : "Edit OpenAI API Key";
  };

  // Function to get placeholder based on type
  const getPlaceholder = () => {
    return type === "name" ? "Enter organization name" : "Enter OpenAI API key";
  };

  // Function to get input type based on type
  const getInputType = () => {
    return type === "name" ? "text" : "password";
  };

  // Function to determine if the save button should be disabled
  const isButtonDisabled = () => {
    if (isUpdating) return true;
    if (!newValue.trim()) return true;

    // For name type, disable if unchanged
    if (type === "name" && newValue.trim() === currentValue) return true;

    // For API key, always enable if there's a value (we don't know the current API key)
    return false;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
          "border border-neutral-300 dark:border-neutral-700"
        )}
      >
        <DialogHeader>
          <DialogTitle className={cn("text-[var(--color-text-dark)]")}>
            {getTitle()}
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          {type === "apiKey" && (
            <div
              className={cn(
                "mb-4 text-sm",
                "text-neutral-600 dark:text-neutral-400"
              )}
            >
              {organizationName
                ? `Update the OpenAI API key for ${organizationName}`
                : "Update your OpenAI API key"}
            </div>
          )}
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={getPlaceholder()}
            type={getInputType()}
            className={cn(
              "mt-2",
              "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
              "border border-neutral-300 dark:border-neutral-700",
              "text-[var(--color-text-dark)]",
              "placeholder:text-neutral-500",
              "focus:ring-2 focus:ring-[var(--color-text-highlight)] focus:border-[var(--color-text-highlight)]"
            )}
            autoFocus
          />
          {type === "apiKey" && (
            <div className={cn("mt-2 text-xs", "text-neutral-500")}>
              Your API key is stored securely and is used to interact with
              OpenAI services.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isUpdating}
            className={cn(
              "transition-all",
              "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
              "border border-neutral-300 dark:border-neutral-700",
              "text-[var(--color-text-dark)]",
              "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
            )}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isButtonDisabled()}
            className={cn(
              "transition-all",
              "bg-[var(--color-text-dark)] text-[var(--color-bg-light)]",
              "hover:opacity-90",
              "disabled:opacity-50"
            )}
          >
            {isUpdating ? (
              <>
                <span className="mr-2">Saving...</span>
                <Loader2 className="h-4 w-4 animate-spin" />
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
