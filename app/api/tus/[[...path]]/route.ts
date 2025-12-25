import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { writeFileSync, appendFileSync, readFileSync, existsSync, statSync, mkdirSync } from "fs";
import { join } from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_SIZE = 100 * 1024 * 1024 * 1024; // 100GB

// Ensure upload directory exists
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

function parseMetadata(metadataHeader: string | null): Record<string, string> {
  if (!metadataHeader) return {};

  const result: Record<string, string> = {};
  const pairs = metadataHeader.split(",");

  for (const pair of pairs) {
    const [key, value] = pair.trim().split(" ");
    if (key && value) {
      try {
        result[key] = Buffer.from(value, "base64").toString("utf-8");
      } catch {
        result[key] = value;
      }
    }
  }

  return result;
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, PATCH, HEAD, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Upload-Length, Upload-Offset, Upload-Metadata, Tus-Resumable, Tus-Version, Tus-Extension, Tus-Max-Size, Content-Length",
    "Access-Control-Expose-Headers": "Upload-Offset, Upload-Length, Tus-Resumable, Tus-Version, Tus-Extension, Tus-Max-Size, Location, Upload-Metadata",
    "Tus-Resumable": "1.0.0",
    "Tus-Version": "1.0.0",
    "Tus-Extension": "creation,creation-with-upload,termination",
    "Tus-Max-Size": String(MAX_SIZE),
  };
}

// OPTIONS - CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

// POST - Create upload
export async function POST(req: NextRequest) {
  try {
    const uploadLength = parseInt(req.headers.get("upload-length") || "0", 10);
    const metadata = parseMetadata(req.headers.get("upload-metadata"));

    const transferId = metadata.transferId;
    const filename = metadata.filename || "unknown";
    const filetype = metadata.filetype || "application/octet-stream";

    if (!transferId) {
      return new Response("Missing transferId in metadata", {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    // Check if transfer exists
    const transfer = await prisma.transfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      return new Response("Transfer not found", {
        status: 404,
        headers: getCorsHeaders(),
      });
    }

    // Generate upload ID
    const uploadId = uuidv4().replace(/-/g, "");
    const filePath = join(UPLOAD_DIR, uploadId);

    // Create empty file
    writeFileSync(filePath, "");

    // Save metadata
    const metadataPath = join(UPLOAD_DIR, `${uploadId}.json`);
    writeFileSync(metadataPath, JSON.stringify({
      id: uploadId,
      metadata,
      size: uploadLength,
      offset: 0,
      creation_date: new Date().toISOString(),
    }));

    // Create database record
    await prisma.file.create({
      data: {
        id: uploadId,
        transferId,
        filename: uploadId,
        originalName: filename,
        size: BigInt(uploadLength),
        mimeType: filetype,
      },
    });

    // Handle creation-with-upload (body contains initial data)
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) {
      appendFileSync(filePath, Buffer.from(body));

      // Update metadata
      const meta = JSON.parse(readFileSync(metadataPath, "utf-8"));
      meta.offset = body.byteLength;
      writeFileSync(metadataPath, JSON.stringify(meta));
    }

    // Use the base URL from env or construct from request headers
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const location = `${protocol}://${host}/api/tus/${uploadId}`;

    return new Response(null, {
      status: 201,
      headers: {
        ...getCorsHeaders(),
        Location: location,
        "Upload-Offset": String(body.byteLength),
      },
    });
  } catch (error) {
    console.error("TUS POST error:", error);
    return new Response("Internal server error", {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
}

// PATCH - Resume upload
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const { path } = await params;
    const uploadId = path?.[0];

    if (!uploadId) {
      return new Response("Upload ID required", {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    const filePath = join(UPLOAD_DIR, uploadId);
    const metadataPath = join(UPLOAD_DIR, `${uploadId}.json`);

    if (!existsSync(metadataPath)) {
      return new Response("Upload not found", {
        status: 404,
        headers: getCorsHeaders(),
      });
    }

    const uploadOffset = parseInt(req.headers.get("upload-offset") || "0", 10);
    const meta = JSON.parse(readFileSync(metadataPath, "utf-8"));

    // Verify offset matches
    if (uploadOffset !== meta.offset) {
      return new Response("Offset mismatch", {
        status: 409,
        headers: {
          ...getCorsHeaders(),
          "Upload-Offset": String(meta.offset),
        },
      });
    }

    // Read body and append to file
    const body = await req.arrayBuffer();
    if (body.byteLength > 0) {
      appendFileSync(filePath, Buffer.from(body));
    }

    const newOffset = meta.offset + body.byteLength;
    meta.offset = newOffset;
    writeFileSync(metadataPath, JSON.stringify(meta));

    // Check if upload is complete
    if (newOffset >= meta.size) {
      await prisma.file.update({
        where: { id: uploadId },
        data: {
          uploadComplete: true,
          uploadOffset: BigInt(newOffset),
          size: BigInt(newOffset),
        },
      });
    } else {
      await prisma.file.update({
        where: { id: uploadId },
        data: {
          uploadOffset: BigInt(newOffset),
        },
      });
    }

    return new Response(null, {
      status: 204,
      headers: {
        ...getCorsHeaders(),
        "Upload-Offset": String(newOffset),
      },
    });
  } catch (error) {
    console.error("TUS PATCH error:", error);
    return new Response("Internal server error", {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
}

// HEAD - Check upload status
export async function HEAD(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const { path } = await params;
    const uploadId = path?.[0];

    if (!uploadId) {
      return new Response(null, {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    const metadataPath = join(UPLOAD_DIR, `${uploadId}.json`);

    if (!existsSync(metadataPath)) {
      return new Response(null, {
        status: 404,
        headers: getCorsHeaders(),
      });
    }

    const meta = JSON.parse(readFileSync(metadataPath, "utf-8"));

    return new Response(null, {
      status: 200,
      headers: {
        ...getCorsHeaders(),
        "Upload-Offset": String(meta.offset),
        "Upload-Length": String(meta.size),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("TUS HEAD error:", error);
    return new Response(null, {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
}

// DELETE - Cancel upload
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  try {
    const { path } = await params;
    const uploadId = path?.[0];

    if (!uploadId) {
      return new Response(null, {
        status: 400,
        headers: getCorsHeaders(),
      });
    }

    const filePath = join(UPLOAD_DIR, uploadId);
    const metadataPath = join(UPLOAD_DIR, `${uploadId}.json`);

    // Delete files
    const { unlinkSync } = await import("fs");
    if (existsSync(filePath)) unlinkSync(filePath);
    if (existsSync(metadataPath)) unlinkSync(metadataPath);

    // Delete database record
    await prisma.file.delete({
      where: { id: uploadId },
    }).catch(() => {});

    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("TUS DELETE error:", error);
    return new Response(null, {
      status: 500,
      headers: getCorsHeaders(),
    });
  }
}
