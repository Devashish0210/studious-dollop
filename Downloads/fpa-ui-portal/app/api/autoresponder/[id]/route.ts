import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Schema for validating Autoresponder data
const AutoresponderSchema = z.object({
  tenantID: z.string(),
  name: z.string(),
  mail_address: z.string().email(),
  autoresponder_status: z.boolean().optional(),
  app_registration_clientid: z.string(),
  app_registration_client_secret: z.string(),
  app_registration_tenantid: z.string(),
  last_retrival_timestamp: z.string().datetime().optional(),
});

const UpdateSchema = AutoresponderSchema.partial();

// Helper function to extract ID from request URL
function getIdFromUrl(request: Request) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  return segments[segments.length - 1];
}

// API function to handle GET requests and fetch a specific autoresponder by ID
export async function GET(request: NextRequest) {
  const id = getIdFromUrl(request);
  const item = await prisma.autoresponder.findUnique({ where: { id } });
  return NextResponse.json(item);
}

// API function to handle PUT requests and update an existing autoresponder
export async function PUT(request: NextRequest) {
  const id = getIdFromUrl(request);
  const body = await request.json();
  const parse = UpdateSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });
  }
  const updated = await prisma.autoresponder.update({
    where: { id },
    data: parse.data,
  });
  return NextResponse.json(updated);
}

// API function to handle DELETE requests and remove an autoresponder by ID
export async function DELETE(request: NextRequest) {
  const id = getIdFromUrl(request);
  await prisma.autoresponder.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
