import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for category workflow structure
const CategoryWorkflowSchema = z.object({
  folder_name: z.string(),
  workflow_category: z.string(),
  workflow: z.string(),
  template: z.string(),
  responder_setting: z.boolean(),
  flag: z.boolean(),
  responder_supervisor: z.string(),
});

// Schema for the complete category_workflows JSON
const CategoryWorkflowsSchema = z.record(z.string(), CategoryWorkflowSchema);

// Schema for validating Autoresponder Categories data
const AutoresponderCategoriesSchema = z.object({
  autoresponderID: z.string(),
  categorizer_workflow_id: z.string().optional(),
  category_workflows: CategoryWorkflowsSchema.optional(),
});

const UpdateSchema = AutoresponderCategoriesSchema.partial();

// Helper function to extract ID from request URL
function getIdFromUrl(request: Request) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  return segments[segments.length - 1];
}

// API function to handle GET requests and fetch a specific autoresponder category by ID
export async function GET(request: NextRequest) {
  try {
    const id = getIdFromUrl(request);
    const item = await prisma.autoresponder_categories.findUnique({
      where: { id },
      include: {
        autoresponder: true, // Include related autoresponder data
      },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Autoresponder category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error("Error fetching autoresponder category:", error);
    return NextResponse.json(
      { error: "Failed to fetch autoresponder category" },
      { status: 500 }
    );
  }
}

// API function to handle PUT requests and update an existing autoresponder category
export async function PUT(request: NextRequest) {
  try {
    const id = getIdFromUrl(request);
    const body = await request.json();
    const parse = UpdateSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: parse.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await prisma.autoresponder_categories.update({
      where: { id },
      data: parse.data,
      include: {
        autoresponder: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating autoresponder category:", error);
    return NextResponse.json(
      { error: "Failed to update autoresponder category" },
      { status: 500 }
    );
  }
}

// API function to handle DELETE requests and remove an autoresponder category by ID
export async function DELETE(request: NextRequest) {
  try {
    const id = getIdFromUrl(request);

    await prisma.autoresponder_categories.delete({
      where: { id },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting autoresponder category:", error);
    return NextResponse.json(
      { error: "Failed to delete autoresponder category" },
      { status: 500 }
    );
  }
}
