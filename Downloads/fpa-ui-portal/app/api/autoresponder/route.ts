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

// API function to handle GET requests and fetch all autoresponders
export async function GET() {
  const items = await prisma.autoresponder.findMany();
  return NextResponse.json(items);
}

// API function to handle POST requests and create a new autoresponder
export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = AutoresponderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const created = await prisma.autoresponder.create({ data: parsed.data });
  return NextResponse.json(created);
}
