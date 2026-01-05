"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Mail,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import "../../app/globals.css";
import { cn } from "@/lib/utils";

// Import components for adding/editing autoresponders and categories
import AddMailbox from "./AddMailbox";
import EditAutoresponder from "./EditAutoresponder";
import AddCategory, { type Category as AddCategoryType } from "./AddCategory";

// Import API functions
import {
  fetchAutoresponderMailbox,
  updateAutoresponderMailbox,
  deleteAutoresponderMailbox,
  fetchCategoriesByAutoresponderID,
  updateAutoresponderCategory,
  deleteAutoresponderCategory,
} from "@/lib/api";

// Define the autoresponder type
interface Autoresponder {
  id: string;
  tenantID: string;
  name: string;
  mail_address: string;
  app_registration_clientid: string;
  app_registration_client_secret: string;
  app_registration_tenantid: string;
  last_retrival_timestamp: string;
  autoresponder_status?: boolean;
  autoresponder_categories?: AutoresponderCategory[];
}

// Define the category type
interface Category {
  id: string;
  folder_name: string;
  workflow_category: string;
  workflow: string;
  template: string;
  responder_setting: boolean;
  flag: boolean;
  responder_supervisor: string;
}

// Define the autoresponder category type
interface AutoresponderCategory {
  id: string;
  autoresponderID: string;
  categorizer_workflow_id?: string;
  category_workflows?: Record<string, Category>;
  autoresponder?: Autoresponder;
}

type ToggleFieldOptions = {
  field: "responder_setting" | "flag";
  setUpdating: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  successMessage: string;
  errorMessage: string;
};

// Main component to view autoresponder settings
const ViewAutoresponderSettings: React.FC = () => {
  const [autoresponders, setAutoresponders] = useState<Autoresponder[]>([]);
  const [categories, setCategories] = useState<Record<string, Category[]>>({});
  const [isAddMailboxOpen, setIsAddMailboxOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false);
  const [selectedAutoresponder, setSelectedAutoresponder] =
    useState<Autoresponder | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<
    (AddCategoryType & { id?: string }) | null
  >(null);
  const [currentAutoresponderID, setCurrentAutoresponderID] =
    useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingCategories, setLoadingCategories] = useState<
    Record<string, boolean>
  >({});
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>(
    {}
  );
  const [updatingResponderSetting, setUpdatingResponderSetting] = useState<
    Record<string, boolean>
  >({});
  const [updatingFlag, setUpdatingFlag] = useState<Record<string, boolean>>({});
  const [deletingAutoresponder, setDeletingAutoresponder] = useState<
    Record<string, boolean>
  >({});
  const [deletingCategory, setDeletingCategory] = useState<
    Record<string, boolean>
  >({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: (() => Promise<void>) | null;
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  // Fetch autoresponders on component mount
  useEffect(() => {
    loadAutoresponders();
  }, []);

  // Function to load autoresponders and their categories
  const loadAutoresponders = async () => {
    try {
      setLoading(true);
      setError(null);
      // API function call to Fetch autoresponder maiboxes
      const data = await fetchAutoresponderMailbox();
      // Set the autoresponders state with the fetched data
      setAutoresponders(data);

      // Load categories for each autoresponder
      const categoriesData: Record<string, Category[]> = {};
      for (const autoresponder of data) {
        // API function call to fetch categories by autoresponder ID
        const autoresponderCategories = await fetchCategoriesByAutoresponderID(
          autoresponder.id
        );
        // Flatten categories and store them in the state
        categoriesData[autoresponder.id] = flattenCategories(
          autoresponderCategories
        );
      }
      // Set the categories state with the fetched categories
      setCategories(categoriesData);
      toast.success("Autoresponders loaded successfully");
    } catch (error) {
      console.error("Error fetching autoresponders:", error);
      setError("Failed to load autoresponders. Please try again.");
      toast.error("Failed to load autoresponders. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Function to load categories for a specific autoresponder
  const loadCategoriesForAutoresponder = async (autoresponderID: string) => {
    try {
      setLoadingCategories((prev) => ({ ...prev, [autoresponderID]: true }));
      // API function call to fetch categories by autoresponder ID
      const autoresponderCategories = await fetchCategoriesByAutoresponderID(
        autoresponderID
      );
      // Flatten the categories and update the state
      const flatCategories = flattenCategories(autoresponderCategories);

      // Set the categories state for the specific autoresponder
      setCategories((prev) => ({
        ...prev,
        [autoresponderID]: flatCategories,
      }));
    } catch (error) {
      console.error("Error loading categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setLoadingCategories((prev) => ({ ...prev, [autoresponderID]: false }));
    }
  };

  // Helper function to flatten category workflows into individual categories
  const flattenCategories = (
    autoresponderCategories: AutoresponderCategory[]
  ): Category[] => {
    const flatCategories: Category[] = [];

    /* Loop through each autoresponder category and extract workflows 
    then push each workflow as a separate category */
    autoresponderCategories.forEach((autoresponderCategory) => {
      if (autoresponderCategory.category_workflows) {
        Object.entries(autoresponderCategory.category_workflows).forEach(
          ([key, workflow]) => {
            flatCategories.push({
              id: `${autoresponderCategory.id}-${key}`,
              folder_name: workflow.folder_name,
              workflow_category: workflow.workflow_category,
              workflow: workflow.workflow,
              template: workflow.template,
              responder_setting: workflow.responder_setting,
              flag: workflow.flag,
              responder_supervisor: workflow.responder_supervisor,
            });
          }
        );
      }
    });

    return flatCategories;
  };

  // Function to handle toggling autoresponder status
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      setUpdatingStatus((prev) => ({ ...prev, [id]: true }));

      // Call the API to update the autoresponder status
      await updateAutoresponderMailbox(id, {
        autoresponder_status: !currentStatus,
      });

      // Update the local state to reflect the new status
      setAutoresponders(
        autoresponders.map((ar) =>
          ar.id === id ? { ...ar, autoresponder_status: !currentStatus } : ar
        )
      );

      toast.success(
        `Autoresponder ${!currentStatus ? "enabled" : "disabled"} successfully`
      );
    } catch (error) {
      console.error("Error updating autoresponder status:", error);
      setError("Failed to update autoresponder status.");
      toast.error("Failed to update autoresponder status");
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Function to handle deleting an autoresponder mailbox
  const handleDeleteAutoresponder = (id: string) => {
    const hasCategories = categories[id] && categories[id].length > 0;
    // Show confirmation dialog before deleting
    showConfirmDialog(
      "Delete Autoresponder",
      hasCategories
        ? "This mailbox has categories. Deleting it will also delete all its categories. Are you sure you want to proceed?"
        : "Are you sure you want to delete this autoresponder mailbox?",
      async () => {
        // Handle the confirmation action
        try {
          // Set the deleting state for this autoresponder
          setDeletingAutoresponder((prev) => ({ ...prev, [id]: true }));

          // Delete all categories for this autoresponder
          if (hasCategories) {
            const autoresponderCategories =
              await fetchCategoriesByAutoresponderID(id);
            for (const autoresponderCategory of autoresponderCategories) {
              await deleteAutoresponderCategory(autoresponderCategory.id);
            }
          }

          // After deleting categories, delete the autoresponder mailbox
          await deleteAutoresponderMailbox(id);
          setAutoresponders((prev) => prev.filter((ar) => ar.id !== id));
          const newCategories = { ...categories };
          delete newCategories[id];
          setCategories(newCategories);

          toast.success("Autoresponder deleted successfully");
        } catch (error) {
          console.error("Error deleting autoresponder:", error);
          setError("Failed to delete autoresponder.");
          toast.error("Failed to delete autoresponder");
        } finally {
          setDeletingAutoresponder((prev) => ({ ...prev, [id]: false }));
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      }
    );
  };

  // Function to handle editing an existing autoresponder mailbox
  const handleEditAutoresponder = (autoresponder: Autoresponder) => {
    setSelectedAutoresponder(autoresponder);
    setIsEditOpen(true);
  };

  // Function to handle adding a new autoresponder category
  const handleAddCategory = (autoresponderID: string) => {
    setCurrentAutoresponderID(autoresponderID);
    setIsAddCategoryOpen(true);
  };

  // Function to handle editing an existing autoresponder category
  const handleEditCategory = (autoresponderID: string, category: Category) => {
    setCurrentAutoresponderID(autoresponderID);
    setSelectedCategory({
      id: category.id.split("-")[0],
      name: category.workflow_category,
      folderName: category.folder_name,
      responderSetting: !!category.responder_setting,
      flag: !!category.flag,
      responderSupervisor: category.responder_supervisor,
    });
    setIsEditCategoryOpen(true);
  };

  // Function to handle deleting an autoresponder category
  const handleDeleteCategory = (
    autoresponderID: string,
    categoryId: string
  ) => {
    showConfirmDialog(
      "Delete Category",
      "Are you sure you want to delete this category?",
      async () => {
        // Handle the confirmation action
        try {
          setDeletingCategory((prev) => ({ ...prev, [categoryId]: true }));

          // Find the autoresponder category that contains this workflow
          const autoresponderCategories =
            await fetchCategoriesByAutoresponderID(autoresponderID);

          let deleted = false;
          for (const autoresponderCategory of autoresponderCategories) {
            if (autoresponderCategory.category_workflows) {
              // If this categoryId matches, delete the entire autoresponderCategory
              const workflowKeys = Object.keys(
                autoresponderCategory.category_workflows
              );
              for (const key of workflowKeys) {
                if (`${autoresponderCategory.id}-${key}` === categoryId) {
                  // If only one workflow, delete the whole category
                  if (workflowKeys.length === 1) {
                    await deleteAutoresponderCategory(autoresponderCategory.id);
                    deleted = true;
                  } else {
                    // Otherwise, just remove the workflow from the object
                    const updatedWorkflows = {
                      ...autoresponderCategory.category_workflows,
                    };
                    delete updatedWorkflows[key];
                    await updateAutoresponderCategory(
                      autoresponderCategory.id,
                      {
                        category_workflows: updatedWorkflows,
                      }
                    );
                  }
                  break;
                }
              }
              if (deleted) break;
            }
          }

          // Update local state
          setCategories((prevCategories) => ({
            ...prevCategories,
            [autoresponderID]: prevCategories[autoresponderID].filter(
              (cat) => cat.id !== categoryId
            ),
          }));

          toast.success("Category deleted successfully");
        } catch (error) {
          console.error("Error deleting category:", error);
          setError("Failed to delete category.");
          toast.error("Failed to delete category");
        } finally {
          setDeletingCategory((prev) => ({ ...prev, [categoryId]: false }));
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        }
      }
    );
  };

  // Function to handle success for opertaions related to category
  const handleCategorySuccess = async (
    autoresponderID: string,
    newCategory: any,
    isEdit: boolean = false
  ) => {
    try {
      // Reload categories for this autoresponder
      await loadCategoriesForAutoresponder(autoresponderID);

      // Close the dialogs
      setIsAddCategoryOpen(false);
      setIsEditCategoryOpen(false);

      toast.success(`Category ${isEdit ? "updated" : "added"} successfully`);
    } catch (error) {
      console.error("Error refreshing categories:", error);
      setError("Failed to refresh categories.");
      toast.error("Failed to refresh categories");
    }
  };

  // Function to toggle a category field (responder_setting or flag)
  const toggleCategoryField = async (
    autoresponderID: string,
    category: Category,
    options: ToggleFieldOptions
  ) => {
    const { field, setUpdating, successMessage, errorMessage } = options;

    try {
      setUpdating((prev) => ({ ...prev, [category.id]: true }));

      const autoresponderCategories = await fetchCategoriesByAutoresponderID(
        autoresponderID
      );

      for (const autoresponderCategory of autoresponderCategories) {
        // Check if the category exists in the workflows
        if (autoresponderCategory.category_workflows) {
          // Find the specific workflow category to update
          const workflows = autoresponderCategory.category_workflows;
          // Loop through each workflow category
          Object.keys(workflows).forEach((key) => {
            if (
              workflows[key].workflow_category === category.workflow_category
            ) {
              workflows[key][field] = !category[field];
            }
          });

          // Update the category workflows in the API
          await updateAutoresponderCategory(autoresponderCategory.id, {
            category_workflows: workflows,
          });
          break;
        }
      }

      // Update the local state to reflect the change
      setCategories((prevCategories) => ({
        ...prevCategories,
        [autoresponderID]: prevCategories[autoresponderID].map((cat) =>
          cat.id === category.id ? { ...cat, [field]: !category[field] } : cat
        ),
      }));

      toast.success(
        `${successMessage} ${category[field] ? "disabled" : "enabled"}`
      );
    } catch (error) {
      console.error(`Error updating category ${field}:`, error);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUpdating((prev) => ({ ...prev, [category.id]: false }));
    }
  };

  // Function to toggle the expansion of a row
  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));

    // Load categories when expanding for the first time
    if (!expandedRows[id] && !categories[id]) {
      loadCategoriesForAutoresponder(id);
    }
  };

  // Function to handle success for operations related to autoresponder mailbox
  const handleMailboxSuccess = (newAutoresponder: Autoresponder) => {
    setAutoresponders([...autoresponders, newAutoresponder]);
    setCategories({ ...categories, [newAutoresponder.id]: [] });
    setIsAddMailboxOpen(false);
    toast.success("Mailbox added successfully");
  };

  // Function to handle success for operations related to editing an autoresponder mailbox
  const handleEditSuccess = (updatedAutoresponder: Autoresponder) => {
    setAutoresponders(
      autoresponders.map((ar) =>
        ar.id === updatedAutoresponder.id ? updatedAutoresponder : ar
      )
    );
    setIsEditOpen(false);
    toast.success("Autoresponder updated successfully");
  };

  // Helper to show confirmation dialog
  const showConfirmDialog = (
    title: string,
    message: string,
    onConfirm: () => Promise<void>
  ) => {
    setConfirmDialog({
      open: true,
      title,
      message,
      onConfirm,
    });
  };

  // Render the Loading state
  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Loading autoresponders...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render the main UI for viewing autoresponder settings
  return (
    <div className="container mx-auto p-6">
      {/* Error  */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setError(null)}
            className="mt-2"
          >
            Dismiss
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">
            Autoresponder Settings
          </CardTitle>
          <CardDescription>Manage your mailbox autoresponders</CardDescription>
          <div className="flex justify-end">
            <Button
              variant="outline"
              className={cn(
                "flex items-center gap-2 text-sm transition-all",
                "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                "border border-neutral-300 dark:border-neutral-700",
                "text-[var(--color-text-dark)]",
                "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
              )}
              onClick={() => setIsAddMailboxOpen(true)}
            >
              <Mail size={18} />
              Add Mailbox
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Render Autoresponder Mailbox table  */}
          <Table>
            <TableCaption>A list of your autoresponders</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Mailbox</TableHead>
                <TableHead>Autoresponder Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {autoresponders.map((autoresponder) => (
                <React.Fragment key={autoresponder.id}>
                  <TableRow>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRowExpansion(autoresponder.id)}
                        className="p-0 h-8 w-8"
                        disabled={loadingCategories[autoresponder.id]}
                      >
                        {loadingCategories[autoresponder.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : expandedRows[autoresponder.id] ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {autoresponder.name}
                    </TableCell>
                    <TableCell>{autoresponder.mail_address}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          autoresponder.autoresponder_status
                            ? "default"
                            : "secondary"
                        }
                        className={cn(
                            "cursor-pointer flex items-center gap-1 transition-colors",
                            "hover:text-[var(--color-text-highlight)]",
                            "hover:bg-[var(--color-button-highlight)]"
                        )}
                        onClick={() =>
                          handleToggleStatus(
                            autoresponder.id,
                            !!autoresponder.autoresponder_status
                          )
                        }
                      >
                        {updatingStatus[autoresponder.id] && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {autoresponder.autoresponder_status
                          ? "Active"
                          : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-8 w-8 p-0 transition-colors",
                            "text-[var(--color-text-dark)]",
                            "hover:text-[var(--color-text-highlight)]",
                            "hover:bg-[var(--color-button-highlight)]"
                          )}
                          onClick={() => handleEditAutoresponder(autoresponder)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-8 w-8 p-0 transition-colors",
                            "text-[var(--color-text-dark)]",
                            "hover:text-[var(--color-text-highlight)]",
                            "hover:bg-[var(--color-button-highlight)]"
                          )}
                          onClick={() =>
                            handleDeleteAutoresponder(autoresponder.id)
                          }
                          disabled={deletingAutoresponder[autoresponder.id]}
                        >
                          {deletingAutoresponder[autoresponder.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded row for categories */}
                  {expandedRows[autoresponder.id] && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <div className="p-4 rounded-md m-2">
                          <h4 className="font-medium mb-2">Categories:</h4>
                          {loadingCategories[autoresponder.id] ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-6 w-6 animate-spin text-primary" />
                              <span className="ml-2 text-muted-foreground">
                                Loading categories...
                              </span>
                            </div>
                          ) : (
                            // Render categories table
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Category Name</TableHead>
                                  <TableHead>Folder Name</TableHead>
                                  <TableHead>Responder Setting</TableHead>
                                  <TableHead>Flag</TableHead>
                                  <TableHead>Responder Supervisor</TableHead>
                                  <TableHead>Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {categories[autoresponder.id] &&
                                categories[autoresponder.id].length > 0 ? (
                                  categories[autoresponder.id].map(
                                    (category, index) => (
                                      <TableRow key={category.id}>
                                        <TableCell>
                                          {category.workflow_category}
                                        </TableCell>
                                        <TableCell>
                                          {category.folder_name}
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            variant={
                                              category.responder_setting
                                                ? "default"
                                                : "secondary"
                                            }
                                            className={cn(
                                              "cursor-pointer flex items-center gap-1 transition-colors",
                                              "hover:text-[var(--color-text-highlight)]",
                                              "hover:bg-[var(--color-button-highlight)]"
                                            )}
                                            onClick={() =>
                                              toggleCategoryField(
                                                autoresponder.id,
                                                category,
                                                {
                                                  field: "responder_setting",
                                                  setUpdating:
                                                    setUpdatingResponderSetting,
                                                  successMessage:
                                                    "Category Responder Setting",
                                                  errorMessage:
                                                    "Failed to update category responder setting.",
                                                }
                                              )
                                            }
                                          >
                                            {updatingResponderSetting[
                                              category.id
                                            ] && (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            )}
                                            {category.responder_setting
                                              ? "Enabled"
                                              : "Disabled"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          <Badge
                                            variant={
                                              category.flag
                                                ? "default"
                                                : "secondary"
                                            }
                                            className={cn(
                                              "cursor-pointer flex items-center gap-1 transition-colors",
                                              "hover:text-[var(--color-text-highlight)]",
                                              "hover:bg-[var(--color-button-highlight)]"
                                            )}
                                            onClick={() =>
                                              toggleCategoryField(
                                                autoresponder.id,
                                                category,
                                                {
                                                  field: "flag",
                                                  setUpdating: setUpdatingFlag,
                                                  successMessage:
                                                    "Category flag",
                                                  errorMessage:
                                                    "Failed to update category flag.",
                                                }
                                              )
                                            }
                                          >
                                            {updatingFlag[category.id] && (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            )}
                                            {category.flag
                                              ? "Enabled"
                                              : "Disabled"}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          {category.responder_supervisor || "-"}
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center justify-end space-x-1">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() =>
                                                handleEditCategory(
                                                  autoresponder.id,
                                                  category
                                                )
                                              }
                                              className={cn(
                                                "h-8 w-8 p-0 transition-colors",
                                                "text-[var(--color-text-dark)]",
                                                "hover:text-[var(--color-text-highlight)]",
                                                "hover:bg-[var(--color-button-highlight)]"
                                              )}
                                            >
                                              <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() =>
                                                handleDeleteCategory(
                                                  autoresponder.id,
                                                  category.id
                                                )
                                              }
                                              className={cn(
                                                "h-8 w-8 p-0 transition-colors",
                                                "text-[var(--color-text-dark)]",
                                                "hover:text-[var(--color-text-highlight)]",
                                                "hover:bg-[var(--color-button-highlight)]"
                                              )}
                                              disabled={
                                                deletingCategory[category.id]
                                              }
                                            >
                                              {deletingCategory[category.id] ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <Trash2 className="h-4 w-4" />
                                              )}
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )
                                  )
                                ) : (
                                  <TableRow>
                                    <TableCell
                                      colSpan={6}
                                      className="text-center py-4"
                                    >
                                      No categories found
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          )}
                          <div className="mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "text-sm transition-all",
                                "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                                "border border-neutral-300 dark:border-neutral-700",
                                "text-[var(--color-text-dark)]",
                                "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
                              )}
                              onClick={() =>
                                handleAddCategory(autoresponder.id)
                              }
                            >
                              Add Category
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}

              {/* If no autoresponders are found, show a message */}
              {autoresponders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    No autoresponders found. Click 'Add Mailbox' to create one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Mailbox Dialog */}
      <Dialog open={isAddMailboxOpen} onOpenChange={setIsAddMailboxOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Mailbox</DialogTitle>
          </DialogHeader>
          <AddMailbox
            onSuccess={handleMailboxSuccess}
            onCancel={() => setIsAddMailboxOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Autoresponder Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Autoresponder</DialogTitle>
          </DialogHeader>
          {selectedAutoresponder && (
            <EditAutoresponder
              autoresponder={selectedAutoresponder}
              onSuccess={handleEditSuccess}
              onCancel={() => setIsEditOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <AddCategory
            autoresponderID={currentAutoresponderID}
            onSuccess={(newCategory) =>
              handleCategorySuccess(currentAutoresponderID, newCategory)
            }
            onCancel={() => setIsAddCategoryOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isEditCategoryOpen} onOpenChange={setIsEditCategoryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          {selectedCategory && (
            <AddCategory
              autoresponderID={currentAutoresponderID}
              existingCategory={selectedCategory}
              isEditMode={true}
              onSuccess={(updatedCategory) =>
                handleCategorySuccess(
                  currentAutoresponderID,
                  updatedCategory,
                  true
                )
              }
              onCancel={() => setIsEditCategoryOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
          </DialogHeader>
          <div className="py-2">{confirmDialog.message}</div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDialog.onConfirm) confirmDialog.onConfirm();
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ViewAutoresponderSettings;
