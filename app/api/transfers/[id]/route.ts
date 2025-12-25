import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { serializeBigInt } from "@/lib/utils";
import fs from "fs/promises";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: {
        files: {
          where: { uploadComplete: true },
          orderBy: { createdAt: "asc" },
        },
      },
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

    const response = {
      id: transfer.id,
      title: transfer.title,
      message: transfer.message,
      sender_email: transfer.senderEmail,
      expires_at: transfer.expiresAt.toISOString(),
      created_at: transfer.createdAt.toISOString(),
      download_count: transfer.downloadCount,
      total_size: Number(transfer.totalSize),
      status: transfer.status,
      has_password: !!transfer.passwordHash,
      files: transfer.files.map((file) => ({
        id: file.id,
        original_name: file.originalName,
        size: Number(file.size),
        mime_type: file.mimeType,
      })),
    };

    return NextResponse.json(serializeBigInt(response));
  } catch (error) {
    console.error("Get transfer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find transfer and verify ownership
    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: { files: true },
    });

    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Check ownership
    if (transfer.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete files from disk
    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    for (const file of transfer.files) {
      const filePath = path.join(uploadDir, file.filename);
      try {
        await fs.unlink(filePath);
      } catch {
        // File might already be deleted
      }
    }

    // Delete transfer (cascade deletes files in DB)
    await prisma.transfer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete transfer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
