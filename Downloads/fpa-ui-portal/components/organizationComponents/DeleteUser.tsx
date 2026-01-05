"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteUser } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import "../../app/globals.css";

// DeleteUser component props interface
interface DeleteUserProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userId: string;
  userEmail: string;
  token: string | null;
}

// DeleteUser component
export default function DeleteUser({
  isOpen,
  onClose,
  onSuccess,
  userId,
  userEmail,
  token,
}: DeleteUserProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  // Function to handle user deletion
  const handleDelete = async () => {
    if (!token || !userId) {
      onClose();
      return;
    }

    try {
      setIsDeleting(true);
      const result = await deleteUser(token, userId);

      if (result) {
        if (onSuccess) {
          onSuccess();
        }
        toast(`User removed: ${userEmail} has been removed from the team.`);
      } else {
        toast(
          "Failed to remove user : There was an error removing the user. Please try again."
        );
      }
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast(
        "Failed to remove user: There was an error removing the user. Please try again."
      );
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className={cn(
        "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
        "border border-neutral-300 dark:border-neutral-700"
      )}>
        <AlertDialogHeader>
          <AlertDialogTitle className={cn(
            "text-[var(--color-text-dark)]"
          )}>
            Remove team member
          </AlertDialogTitle>
          <AlertDialogDescription className={cn(
            "text-neutral-600 dark:text-neutral-400"
          )}>
            Are you sure you want to remove{" "}
            <span className={cn(
              "font-medium",
              "text-[var(--color-text-dark)]"
            )}>
              {userEmail}
            </span>{" "}
            from the team? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isDeleting}
            className={cn(
              "transition-all",
              "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
              "border border-neutral-300 dark:border-neutral-700",
              "text-[var(--color-text-dark)]",
              "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
            )}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={isDeleting}
            className={cn(
              "transition-all",
              "bg-[var(--color-text-highlight)] text-white",
              "hover:opacity-90",
              "disabled:opacity-50"
            )}
          >
            {isDeleting ? (
              <>
                <span className="mr-2">Removing...</span>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </>
            ) : (
              "Remove"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
