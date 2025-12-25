import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { authOptions, getUserPlanLimits, PLAN_LIMITS } from "@/lib/auth";
import { z } from "zod";

const createTransferSchema = z.object({
  title: z.string().optional(),
  message: z.string().optional(),
  sender_email: z.string().email().optional().or(z.literal("")),
  recipient_emails: z.array(z.string().email()).optional(),
  password: z.string().optional(),
  expires_in_days: z.number().min(1).max(30).default(7),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createTransferSchema.parse(body);

    // Get session (optional - allows anonymous uploads with free limits)
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Get plan limits
    let planLimits = PLAN_LIMITS.free;
    if (userId) {
      planLimits = await getUserPlanLimits(userId);
    }

    // Enforce expiry limit based on plan
    let expiresInDays = data.expires_in_days;
    if (expiresInDays > planLimits.maxExpiryDays) {
      expiresInDays = planLimits.maxExpiryDays;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    let passwordHash: string | null = null;
    if (data.password && data.password.length > 0) {
      passwordHash = await hashPassword(data.password);
    }

    const transfer = await prisma.transfer.create({
      data: {
        userId: userId || null,
        title: data.title || null,
        message: data.message || null,
        senderEmail: data.sender_email || null,
        recipientEmails: data.recipient_emails?.join(",") || null,
        passwordHash,
        expiresAt,
        status: "pending",
      },
    });

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";

    return NextResponse.json({
      id: transfer.id,
      title: transfer.title,
      message: transfer.message,
      download_url: `${baseUrl}/download/${transfer.id}`,
      expires_at: transfer.expiresAt.toISOString(),
      file_count: 0,
      total_size: 0,
      has_password: !!passwordHash,
      plan_limits: {
        max_size: planLimits.maxTransferSize,
        max_expiry_days: planLimits.maxExpiryDays,
      },
    });
  } catch (error) {
    console.error("Create transfer error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
