"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { inviteUserToOrganization } from "@/lib/api";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import "../../app/globals.css";

// InviteUser component props interface
interface InviteUserProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// InviteUser component
export default function InviteUser({
  isOpen,
  onClose,
  onSuccess,
}: InviteUserProps) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const { data: session } = useSession();

  // Fetch token from session
  useEffect(() => {
    setToken((session as any)?.user?.accessToken);
  }, [session]);

  // Function to handle user invitation
  const handleInvite = async () => {
    if (!email || !token) {
      setError("Email and organization information are required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        email: email,
      };

      // Call API to invite user
      const result = await inviteUserToOrganization(token, payload);

      if (result) {
        setEmail("");
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      } else {
        setError("Failed to invite user. Please try again.");
      }
    } catch (err) {
      setError("An error occurred while inviting the user");
      console.error("Invite error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "sm:max-w-md",
        "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
        "border border-neutral-300 dark:border-neutral-700"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "text-[var(--color-text-dark)]"
          )}>
            Invite Team Member
          </DialogTitle>
          <DialogDescription className={cn(
            "text-neutral-600 dark:text-neutral-400"
          )}>
            Invite new member by email address
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className={cn(
                "text-[var(--color-text-dark)]"
              )}
            >
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                "border border-neutral-300 dark:border-neutral-700",
                "text-[var(--color-text-dark)]",
                "placeholder:text-neutral-500",
                "focus:ring-2 focus:ring-[var(--color-text-highlight)] focus:border-[var(--color-text-highlight)]"
              )}
            />
          </div>

          <Alert className={cn(
            "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400"
          )}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              We currently don't have a notification system in place. Once you
              invite a user, please notify them that they need to sign up to the
              console.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert className={cn(
              "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
            )}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
            disabled={isLoading}
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
            type="button"
            onClick={handleInvite}
            disabled={isLoading || !email}
            className={cn(
              "transition-all",
              "bg-[var(--color-text-dark)] text-[var(--color-bg-light)]",
              "hover:opacity-90",
              "disabled:opacity-50"
            )}
          >
            {isLoading ? "Inviting..." : "Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
