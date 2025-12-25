import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendDownloadNotification } from "@/lib/email";

export async function POST(
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
        },
      },
    });

    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    // Calculate total size
    const totalSize = transfer.files.reduce(
      (sum, file) => sum + file.size,
      BigInt(0)
    );

    // Update transfer status
    await prisma.transfer.update({
      where: { id },
      data: {
        status: "complete",
        totalSize,
      },
    });

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const downloadUrl = `${baseUrl}/download/${id}`;

    // Send email notifications asynchronously
    if (transfer.recipientEmails) {
      const recipients = transfer.recipientEmails
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      if (recipients.length > 0) {
        // Don't await - send in background
        sendDownloadNotification(
          {
            id: transfer.id,
            title: transfer.title,
            message: transfer.message,
            senderEmail: transfer.senderEmail,
            fileCount: transfer.files.length,
            totalSize,
            expiresAt: transfer.expiresAt,
          },
          recipients
        ).catch((err) => console.error("Email notification failed:", err));
      }
    }

    return NextResponse.json({
      id: transfer.id,
      download_url: downloadUrl,
      file_count: transfer.files.length,
      total_size: Number(totalSize),
      expires_at: transfer.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error("Complete transfer error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
