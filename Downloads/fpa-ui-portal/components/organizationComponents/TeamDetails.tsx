"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, UsersRound, UserRound, UserPlus } from "lucide-react";
import InviteUser from "./InviteUser";
import DeleteUser from "./DeleteUser";
import { cn } from "@/lib/utils";
import "../../app/globals.css";

// define the structure of team members
interface TeamMember {
  email: string;
  name: string;
  displayEmail?: string;
  status?: "active" | "pending";
  initial: string;
  id?: string;
}

// TeamDetails component props interface
interface TeamDetailsProps {
  teamMembers: TeamMember[];
  loading: boolean;
  onUserDeleted?: () => void;
  currentUserEmail?: string;
  token: string | null;
  error: any | null;
}

// TeamDetails component
export default function TeamDetails({
  teamMembers,
  loading,
  onUserDeleted,
  currentUserEmail,
  token,
  error,
}: TeamDetailsProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{
    id: string;
    email: string;
  } | null>(null);

  // Function to handle delete button click
  const handleDeleteClick = (userId: string, userEmail: string) => {
    setUserToDelete({ id: userId, email: userEmail });
    setIsDeleteModalOpen(true);
  };

  // Show loading if still fetching team members
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <UsersRound size={20} className={cn(
            "text-[var(--color-text-dark)]"
          )} />
          <h2 className={cn(
            "font-medium",
            "text-[var(--color-text-dark)]"
          )}>
            Team
          </h2>
        </div>
        <div className="flex justify-center py-8">
          <div className={cn(
            "animate-pulse",
            "text-neutral-600 dark:text-neutral-400"
          )}>
            Loading team members...
          </div>
        </div>
      </div>
    );
  }

  // Show error if there was an issue loading team members
  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <UsersRound size={20} className={cn(
            "text-[var(--color-text-dark)]"
          )} />
          <h2 className={cn(
            "font-medium",
            "text-[var(--color-text-dark)]"
          )}>
            Team
          </h2>
        </div>
        <div className="flex justify-center py-8 text-red-500">
          Error loading team members. Please try again.
        </div>
      </div>
    );
  }

  // Render team members
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <UsersRound size={20} className={cn(
          "text-[var(--color-text-dark)]"
        )} />
        <h2 className={cn(
          "font-medium",
          "text-[var(--color-text-dark)]"
        )}>
          Team
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        {/* If Team members are not there */}
        {teamMembers.length === 0 ? (
          <div className={cn(
            "py-4 text-center",
            "text-neutral-500"
          )}>
            No team members found
          </div>
        ) : (
          teamMembers.map((member, index) => (
            <div key={index} className={cn(
              "flex items-center justify-between py-2 px-2 rounded-md transition-colors",
            )}>
              <div className="flex items-center gap-3">
                {member.status === "pending" ? (
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    "bg-neutral-200 dark:bg-neutral-700"
                  )}>
                    <UserRound size={16} className="text-neutral-400" />
                  </div>
                ) : (
                  <Avatar className={cn(
                    "w-8 h-8",
                    "bg-neutral-500 text-white"
                  )}>
                    <AvatarFallback className="bg-neutral-500 text-white">
                      {member.initial}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className="flex flex-col">
                  <span className={cn(
                    "text-sm font-medium",
                    "text-[var(--color-text-dark)]"
                  )}>
                    {member.name}
                  </span>
                  <span className={cn(
                    "text-xs font-medium",
                    "text-neutral-600 dark:text-neutral-400"
                  )}>
                    {member.email}
                  </span>
                </div>
                {member.status === "pending" && (
                  <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 py-1 px-2 rounded-full">
                    Pending sign up
                  </span>
                )}
                {member.email === currentUserEmail && (
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 py-1 px-2 rounded-full">
                    You
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {member.email !== currentUserEmail && member.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 p-0 transition-colors",
                      teamMembers.length <= 1
                        ? "text-neutral-300 cursor-not-allowed"
                        : cn(
                          "text-[var(--color-text-dark)]",
                          "hover:text-[var(--color-text-highlight)]",
                          "hover:bg-[var(--color-button-highlight)]"
                        )
                    )}
                    onClick={() => handleDeleteClick(member.id!, member.email)}
                    disabled={teamMembers.length <= 1}
                  >
                    <Trash2 size={16} />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex justify-end mt-4">
        <Button
          variant="outline"
          className={cn(
            "text-sm transition-all",
            "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
            "border border-neutral-300 dark:border-neutral-700",
            "text-[var(--color-text-dark)]",
            "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
          )}
          onClick={() => setIsInviteModalOpen(true)}
        >
          <UserPlus size={16} className="mr-2" />
          Invite
        </Button>
      </div>

      {/* Invite user Component */}
      <InviteUser
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={onUserDeleted}
      />

      {/* Delete user Component */}
      {userToDelete && (
        <DeleteUser
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onSuccess={onUserDeleted}
          userId={userToDelete.id}
          userEmail={userToDelete.email}
          token={token}
        />
      )}
    </div>
  );
}
