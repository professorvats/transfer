import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createReadStream, statSync, existsSync } from "fs";
import path from "path";
import { Readable } from "stream";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const { id, fileId } = await params;
    const password = req.nextUrl.searchParams.get("password");

    // Get transfer with file
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

    // Get file
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        transferId: id,
        uploadComplete: true,
      },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Find the file on disk
    let filePath = path.join(UPLOAD_DIR, file.filename);

    // Check for .bin extension if file doesn't exist
    if (!existsSync(filePath)) {
      filePath = filePath + ".bin";
    }

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "File not found on disk" },
        { status: 404 }
      );
    }

    const stats = statSync(filePath);
    const stream = createReadStream(filePath);

    // Increment download count
    await prisma.transfer.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });

    // Convert Node stream to Web stream
    const webStream = Readable.toWeb(stream) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
        "Content-Length": String(stats.size),
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("Download file error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
