"use client";

import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Key, Lock, Building, User } from "lucide-react";
import { updateAutoresponderMailbox } from "@/lib/api";

// Define the schema for form validation
const formSchema = z.object({
  tenantID: z.string().min(1, "Tenant ID is required"),
  name: z.string().min(1, "Name is required"),
  mail_address: z.string().email("Invalid email address"),
  autoresponder_status: z.boolean().optional(),
  app_registration_clientid: z.string().min(1, "App Registration Client ID is required"),
  app_registration_client_secret: z
    .string()
    .min(1, "App Registration Client Secret is required"),
  app_registration_tenantid: z.string().min(1, "App Registration Tenant ID is required"),
});

type FormData = z.infer<typeof formSchema>;

// structure for the autoresponder object
interface Autoresponder {
  id: string;
  tenantID: string;
  name: string;
  mail_address: string;
  app_registration_clientid: string;
  app_registration_client_secret: string;
  app_registration_tenantid: string;
  autoresponder_status?: boolean;
}

// Props structure for the EditAutoresponder component
interface EditAutoresponderProps {
  autoresponder: Autoresponder;
  onSuccess: (updatedAutoresponder: any) => void;
  onCancel: () => void;
}

// EditAutoresponder component for editing an existing autoresponder mailbox
const EditAutoresponder: React.FC<EditAutoresponderProps> = ({
  autoresponder,
  onSuccess,
  onCancel,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with react-hook-form and pre-fill with existing autoresponder data
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tenantID: autoresponder.tenantID,
      name: autoresponder.name,
      mail_address: autoresponder.mail_address,
      autoresponder_status: autoresponder.autoresponder_status || false,
      app_registration_clientid: autoresponder.app_registration_clientid,
      app_registration_client_secret:
        autoresponder.app_registration_client_secret,
      app_registration_tenantid: autoresponder.app_registration_tenantid,
    },
  });

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Use the API function to update the autoresponder
      const updatedAutoresponder = await updateAutoresponderMailbox(
        autoresponder.id,
        data
      );

      // Call the success callback with the updated autoresponder data
      onSuccess(updatedAutoresponder);
    } catch (error: any) {
      console.error("Error updating autoresponder:", error);
      setError(error.message || "Failed to update autoresponder. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      {/* Form Fields or UI for Edit/Update Autoresponder Mailbox */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        {/* Alert to show if any errors */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <div className="flex items-center relative">
                  <User className="absolute left-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Enter mailbox name"
                    className="pl-10"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mail_address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mailbox Email</FormLabel>
              <FormControl>
                <div className="flex items-center relative">
                  <Mail className="absolute left-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="example@domain.com"
                    className="pl-10"
                    {...field}
                    disabled // Make email address non-editable as it's the identifier
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tenantID"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tenant ID</FormLabel>
              <FormControl>
                <div className="flex items-center relative">
                  <Building className="absolute left-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Enter tenant ID"
                    className="pl-10"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="app_registration_clientid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>App Registration Client ID</FormLabel>
              <FormControl>
                <div className="flex items-center relative">
                  <Key className="absolute left-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Enter client ID"
                    className="pl-10"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="app_registration_client_secret"
          render={({ field }) => (
            <FormItem>
              <FormLabel>App Registration Client Secret</FormLabel>
              <FormControl>
                <div className="flex items-center relative">
                  <Lock className="absolute left-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="Enter client secret"
                    className="pl-10"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="app_registration_tenantid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>App Registration Tenant ID</FormLabel>
              <FormControl>
                <div className="flex items-center relative">
                  <Building className="absolute left-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Enter app registration tenant ID"
                    className="pl-10"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="autoresponder_status"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Autoresponder Status</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Enable or disable the autoresponder
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Buttons for Submit and Cancel Options */}
        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default EditAutoresponder;
