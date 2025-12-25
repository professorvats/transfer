import archiver from "archiver";
import { createReadStream } from "fs";
import path from "path";
import { Readable } from "stream";

interface FileInfo {
  filename: string;
  originalName: string;
}

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

export function createZipStream(files: FileInfo[]): Readable {
  const archive = archiver("zip", {
    zlib: { level: 5 },
  });

  archive.on("error", (err) => {
    console.error("Archive error:", err);
    throw err;
  });

  for (const file of files) {
    const filePath = path.join(UPLOAD_DIR, file.filename);
    archive.append(createReadStream(filePath), { name: file.originalName });
  }

  archive.finalize();

  return archive;
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\:*?"<>|]/g, "_")
    .substring(0, 50);
}
