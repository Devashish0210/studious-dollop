"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Building2, Copy, PencilIcon, Loader2, Lock, Info, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { fetchOrganization } from "@/lib/api";
import UpdateOrganization from "./UpdateOrganization";
import { Card, CardContent, CardHeader } from "../ui/card";
import { cn } from "@/lib/utils";
import "../../app/globals.css";

// OrganizationDetails component props interface
interface OrganizationDetailsProps {
  orgId: string;
  token?: string | null;
}

// OrganizationDetails component
export default function OrganizationDetails({
  orgId,
  token,
}: OrganizationDetailsProps) {
  const [copied, setCopied] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditNameModalOpen, setIsEditNameModalOpen] = useState(false);
  const [isEditApiKeyModalOpen, setIsEditApiKeyModalOpen] = useState(false);

  // Function to fetch organization data
  const fetchOrgData = async () => {
    // Check if orgId and token are valid before making the API call
    if (!token || !orgId || orgId === "Not Available" || orgId.trim() === "") {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchOrganization(token, orgId);

      if (data) {
        setOrgData(data);
      } else {
        setError("Failed to load organization details");
      }
    } catch (err) {
      console.error("Failed to fetch organization:", err);
      setError("Error loading organization details");
    } finally {
      setLoading(false);
    }
  };

  // Fetch organization data on initial load
  useEffect(() => {
    fetchOrgData();
  }, [token, orgId]);

  // Function to copy organization ID to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show loading if orgId is not yet available
  if (!orgId || orgId === "Not Available" || orgId.trim() === "") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Building2 className={cn(
            "text-[var(--color-text-dark)]"
          )} />
          <h1 className={cn(
            "text-2xl font-semibold",
            "text-[var(--color-text-dark)]"
          )}>
            Organization
          </h1>
        </div>
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
        </div>
      </div>
    );
  }

  // Show loading if still fetching organization data
  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Building2 className={cn(
            "text-[var(--color-text-dark)]"
          )} />
          <h1 className={cn(
            "text-2xl font-semibold",
            "text-[var(--color-text-dark)]"
          )}>
            Organization
          </h1>
        </div>
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
        </div>
      </div>
    );
  }

  // Show error if there was an issue fetching organization data
  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Building2 className={cn(
            "text-[var(--color-text-dark)]"
          )} />
          <h1 className={cn(
            "text-2xl font-semibold",
            "text-[var(--color-text-dark)]"
          )}>
            Organization Details
          </h1>
        </div>
        <div className="py-4 text-red-500">{error}</div>
      </div>
    );
  }

  // Render organization details
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Organization Name Card */}
      <Card className={cn(
        "shadow-sm",
        "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
        "border border-neutral-300 dark:border-neutral-700"
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Building2 className={cn(
              "h-5 w-5",
              "text-[var(--color-text-dark)]"
            )} />
            <h1 className={cn(
              "text-xl font-semibold",
              "text-[var(--color-text-dark)]"
            )}>
              Organization Details
            </h1>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <p className={cn(
              "text-sm mb-1",
              "text-neutral-600 dark:text-neutral-400"
            )}>
              Organization name
            </p>
            <div className="flex justify-between items-center mt-1">
              <h2 className={cn(
                "font-medium",
                "text-[var(--color-text-dark)]"
              )}>
                {orgData?.name || "Organization Name"}
              </h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 p-0 transition-colors",
                        "text-[var(--color-text-dark)]",
                        "hover:text-[var(--color-text-highlight)]",
                        "hover:bg-[var(--color-button-highlight)]"
                      )}
                      onClick={() => setIsEditNameModalOpen(true)}
                    >
                      <PencilIcon size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit Organization Name</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="mt-4">
            <p className={cn(
              "text-sm",
              "text-neutral-600 dark:text-neutral-400"
            )}>
              Organization ID
            </p>
            <div className="flex justify-between items-center">
              <h2 className={cn(
                "font-medium",
                "text-[var(--color-text-dark)]"
              )}>
                {orgId}
              </h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 p-0 transition-colors",
                        "text-[var(--color-text-dark)]",
                        "hover:text-[var(--color-text-highlight)]",
                        "hover:bg-[var(--color-button-highlight)]"
                      )}
                      onClick={() => copyToClipboard(orgId)}
                    >
                      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy size={16} />}

                      <span className="sr-only">Copy</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{copied ? "Copied!" : "Copy ID"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>

        {/* Update Organization component for name update */}
        <UpdateOrganization
          isOpen={isEditNameModalOpen}
          onClose={() => setIsEditNameModalOpen(false)}
          onSuccess={fetchOrgData}
          type="name"
          orgId={orgId}
          token={token || null}
          currentValue={orgData?.name || ""}
        />
      </Card>

      {/* OpenAI API Key Card */}
      <Card className={cn(
        "shadow-sm",
        "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
        "border border-neutral-300 dark:border-neutral-700"
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Lock className={cn(
              "h-5 w-5",
              "text-[var(--color-text-dark)]"
            )} />
            <h1 className={cn(
              "text-xl font-semibold",
              "text-[var(--color-text-dark)]"
            )}>
              OpenAI API Key
            </h1>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className={cn(
            "text-sm",
            "text-neutral-600 dark:text-neutral-400"
          )}>
            Connect your own OpenAI API key to the platform
          </p>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div>
                <span className={cn(
                  "text-sm font-medium",
                  "text-[var(--color-text-dark)]"
                )}>
                  API Key
                </span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 p-0 transition-colors",
                        "text-[var(--color-text-dark)]",
                        "hover:text-[var(--color-text-highlight)]",
                        "hover:bg-[var(--color-button-highlight)]"
                      )}
                      onClick={() => setIsEditApiKeyModalOpen(true)}
                    >
                      <PencilIcon size={16} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit API KEY</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className={cn(
              "w-full text-sm",
              "text-neutral-500"
            )}>
              sk-••••••••••••••••••••••••••••••••••••••••••••••••••
            </div>

            <div className={cn(
              "flex items-center gap-2 text-xs",
              "text-neutral-600 dark:text-neutral-400"
            )}>
              <Info size={16} />
              <span>The API Key is not visible for security reasons</span>
            </div>
          </div>
        </CardContent>

        {/* Update Organization component for API key update */}
        <UpdateOrganization
          isOpen={isEditApiKeyModalOpen}
          onClose={() => setIsEditApiKeyModalOpen(false)}
          onSuccess={fetchOrgData}
          type="apiKey"
          orgId={orgId}
          token={token || null}
          organizationName={orgData?.name || ""}
        />
      </Card>
    </div>
  );
}
