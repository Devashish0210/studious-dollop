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

// API function to handle GET requests and fetch all autoresponder categories
export async function GET() {
  try {
    const items = await prisma.autoresponder_categories.findMany({
      include: {
        autoresponder: true,
      },
    });
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching autoresponder categories:", error);
    return NextResponse.json(
      { error: "Failed to fetch autoresponder categories" },
      { status: 500 }
    );
  }
}

// API function to handle POST requests and create a new autoresponder category
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AutoresponderCategoriesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const created = await prisma.autoresponder_categories.create({
      data: parsed.data,
      include: {
        autoresponder: true,
      },
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error("Error creating autoresponder category:", error);
    return NextResponse.json(
      { error: "Failed to create autoresponder category" },
      { status: 500 }
    );
  }
}
