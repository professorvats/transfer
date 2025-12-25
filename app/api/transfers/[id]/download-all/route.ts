import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createZipStream, sanitizeFilename } from "@/lib/zip";
import { Readable } from "stream";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const password = req.nextUrl.searchParams.get("password");

    // Get transfer with files
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

    // Check if expired or deleted
    if (transfer.status === "deleted" || new Date() > transfer.expiresAt) {
      return NextResponse.json(
        { error: "Transfer has expired or been deleted" },
        { status: 410 }
      );
    }

    // Verify password if required
    if (transfer.passwordHash) {
      if (!password) {
        return NextResponse.json(
          { error: "Password required" },
          { status: 401 }
        );
      }

      const isValid = await verifyPassword(password, transfer.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
    }

    if (transfer.files.length === 0) {
      return NextResponse.json({ error: "No files to download" }, { status: 404 });
    }

    // Increment download count
    await prisma.transfer.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });

    // Create ZIP filename
    const title = transfer.title || "transfer";
    const sanitizedTitle = sanitizeFilename(title);
    const zipFilename = `${sanitizedTitle}_${id.substring(0, 8)}.zip`;

    // Create ZIP stream
    const zipStream = createZipStream(
      transfer.files.map((f) => ({
        filename: f.filename,
        originalName: f.originalName,
      }))
    );

    // Convert Node stream to Web stream
    const webStream = Readable.toWeb(zipStream) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(zipFilename)}"`,
      },
    });
  } catch (error) {
    console.error("Download all error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
