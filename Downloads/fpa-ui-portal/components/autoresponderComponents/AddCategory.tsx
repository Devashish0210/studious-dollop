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
import { Tag, Folder, MessageSquare, Flag, User } from "lucide-react";
import {
  addAutoresponderCategory,
  updateAutoresponderCategory,
} from "@/lib/api";

// Define the schema for form validation
const formSchema = z.object({
  name: z.string().min(1, "Category name is required"),
  folderName: z.string().min(1, "Folder name is required"),
  responderSetting: z.boolean(),
  flag: z.boolean(),
  responderSupervisor: z.string().min(1, "Responder supervisor is required"),
});

type FormData = z.infer<typeof formSchema>;

// structure for the category object
export interface Category {
  name: string;
  folderName: string;
  responderSetting: boolean;
  flag: boolean;
  responderSupervisor: string;
}

// Props structure for the AddCategory component
interface AddCategoryProps {
  autoresponderID: string;
  onSuccess: (newCategory: Category) => void;
  onCancel: () => void;
  existingCategory?: Category & { id?: string };
  isEditMode?: boolean;
}

// AddCategory component for adding or editing autoresponder categories
const AddCategory: React.FC<AddCategoryProps> = ({
  autoresponderID,
  onSuccess,
  onCancel,
  existingCategory,
  isEditMode = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with react-hook-form
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues:
      isEditMode && existingCategory
        ? {
            name: existingCategory.name,
            folderName: existingCategory.folderName,
            responderSetting: existingCategory.responderSetting,
            flag: existingCategory.flag,
            responderSupervisor: existingCategory.responderSupervisor,
          }
        : {
            name: "",
            folderName: "",
            responderSetting: false,
            flag: false,
            responderSupervisor: "",
          },
  });

  // Handle form submission
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      const category_workflows = {
        [data.name]: {
          folder_name: data.folderName,
          workflow_category: data.name,
          responder_setting: data.responderSetting,
          flag: data.flag,
          responder_supervisor: data.responderSupervisor,
          workflow: "",
          template: "",
        },
      };

      const payload = {
        autoresponderID,
        category_workflows,
      };

      let result;
      // Check if we are in edit mode and if an existing category id is provided
      if (isEditMode && existingCategory && existingCategory.id) {
        // Update the existing category by calling the API
        result = await updateAutoresponderCategory(
          existingCategory.id,
          payload
        );
      } else {
        // If not in edit mode, create a new category by calling the API
        result = await addAutoresponderCategory(payload);
      }

      // If the API call was successful, trigger the onSuccess callback
      if (result) {
        onSuccess({
          name: data.name,
          folderName: data.folderName,
          responderSetting: data.responderSetting,
          flag: data.flag,
          responderSupervisor: data.responderSupervisor,
        });
      }
    } catch (error) {
      console.error("Error saving category:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      {/* Form Fields or UI for Add/Update Category */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category Name</FormLabel>
              <FormControl>
                <div className="flex items-center relative">
                  <Tag className="absolute left-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Enter category name"
                    className="pl-10"
                    {...field}
                    disabled={isEditMode}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="folderName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Folder Name</FormLabel>
              <FormControl>
                <div className="flex items-center relative">
                  <Folder className="absolute left-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Enter folder name"
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
          name="responderSetting"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>
                  <div className="flex items-center">
                    <MessageSquare className="mr-2 h-4 w-4 text-gray-400" />
                    Enable Responder Setting
                  </div>
                </FormLabel>
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

        <FormField
          control={form.control}
          name="flag"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>
                  <div className="flex items-center">
                    <Flag className="mr-2 h-4 w-4 text-gray-400" />
                    Enable Flag
                  </div>
                </FormLabel>
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

        <FormField
          control={form.control}
          name="responderSupervisor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Responder Supervisor</FormLabel>
              <FormControl>
                <div className="flex items-center relative">
                  <User className="absolute left-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Enter supervisor name"
                    className="pl-10"
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage />
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

          {/* if isEditMode is true then show Updating and Update
          Category labels else show Adding and Add Category labels */}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isEditMode
                ? "Updating..."
                : "Adding..."
              : isEditMode
              ? "Update Category"
              : "Add Category"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default AddCategory;
