import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { password } = body;

    const transfer = await prisma.transfer.findUnique({
      where: { id },
    });

    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Check if expired or deleted
    if (transfer.status === "deleted" || new Date() > transfer.expiresAt) {
      return NextResponse.json(
        { error: "Transfer has expired or been deleted" },
        { status: 410 }
      );
    }

    // If no password is set, return valid
    if (!transfer.passwordHash) {
      return NextResponse.json({ valid: true });
    }

    // Verify password
    if (!password) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const isValid = await verifyPassword(password, transfer.passwordHash);

    if (!isValid) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Verify password error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
