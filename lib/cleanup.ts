import { prisma } from "./prisma";
import { unlinkSync, existsSync } from "fs";
import path from "path";
import cron from "node-cron";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

export async function cleanupExpiredTransfers() {
  console.log("Running cleanup for expired transfers...");

  try {
    // Find all expired transfers that aren't already deleted
    const expiredTransfers = await prisma.transfer.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        status: {
          not: "deleted",
        },
      },
      include: {
        files: true,
      },
    });

    console.log(`Found ${expiredTransfers.length} expired transfers to clean up`);

    for (const transfer of expiredTransfers) {
      // Delete physical files
      for (const file of transfer.files) {
        try {
          let filePath = path.join(UPLOAD_DIR, file.filename);

          // Check with .bin extension if file doesn't exist
          if (!existsSync(filePath)) {
            filePath = filePath + ".bin";
          }

          if (existsSync(filePath)) {
            unlinkSync(filePath);
            console.log(`Deleted file: ${filePath}`);
          }
        } catch (err) {
          console.error(`Failed to delete file ${file.filename}:`, err);
        }
      }

      // Mark transfer as deleted
      await prisma.transfer.update({
        where: { id: transfer.id },
        data: { status: "deleted" },
      });

      console.log(`Marked transfer ${transfer.id} as deleted`);
    }

    console.log("Cleanup completed");
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

let schedulerStarted = false;

export function startCleanupScheduler() {
  if (schedulerStarted) {
    return;
  }

  // Run cleanup every hour
  cron.schedule("0 * * * *", () => {
    cleanupExpiredTransfers();
  });

  schedulerStarted = true;
  console.log("Cleanup scheduler started (runs every hour)");

  // Run initial cleanup
  cleanupExpiredTransfers();
}
