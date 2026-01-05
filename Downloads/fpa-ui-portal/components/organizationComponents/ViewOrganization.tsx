"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import OrganizationDetails from "./OrganizationDetails";
import TeamDetails from "./TeamDetails";
import { fetchUsers } from "@/lib/api";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import "../../app/globals.css";

// Define the structure of team member data
interface TeamMember {
  organizationId: string;
  email: string;
  name: string;
  displayEmail?: string;
  status?: "active" | "pending";
  initial: string;
  id?: string;
}

// ViewOrganization component
export default function ViewOrganization() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch token from session storage and set it in state
  useEffect(() => {
    setToken((session as any)?.user?.accessToken);
  }, [session]);

  // Function to load users from the API
  const loadUsers = useCallback(async () => {
    if (token) {
      try {
        setLoading(true);
        setError(null);

        const userData = await fetchUsers(token);
        if (userData) {
          // Transform API user data to match TeamMember interface
          const formattedTeamMembers = userData.map((user: any) => ({
            organizationId: user.organization_id,
            email: user.email,
            name: user.name,
            displayEmail: user.email,
            status: user.name ? "active" : "pending",
            initial: getInitials(user.email),
            id: user.id || user._id,
          }));
          setTeamMembers(formattedTeamMembers);
        }
      } catch (err) {
        console.error("Failed to load users:", err);
        setError("Failed to load team members. Please try again later.");
      } finally {
        setLoading(false);
      }
    }
  }, [token]);

  // Load users when the component mounts
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Helper function to get initials from email
  const getInitials = (email: string): string => {
    if (!email) return "";
    const parts = email.split("@")[0].split(".");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {error && (
        <div className="p-4 border border-red-300 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
          {error}
        </div>
      )}

      {/* Organization Details Component */}
      <OrganizationDetails
        orgId={
          teamMembers && teamMembers.length > 0 && teamMembers[0].organizationId
            ? teamMembers[0].organizationId
            : "Not Available"
        }
        token={token}
      />

      {/* Team members Component */}
      <Card className={cn(
        "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
        "border border-neutral-300 dark:border-neutral-700"
      )}>
        <CardContent className="p-4">
          <TeamDetails
            teamMembers={teamMembers}
            loading={loading}
            onUserDeleted={loadUsers}
            currentUserEmail={(session as any)?.user?.email}
            token={token}
            error={error}
          />
        </CardContent>
      </Card>
    </div>
  );
}
