import { NextResponse } from "next/server";
import { cleanupExpiredTransfers } from "@/lib/cleanup";

export async function GET() {
  try {
    await cleanupExpiredTransfers();
    return NextResponse.json({ success: true, message: "Cleanup completed" });
  } catch (error) {
    console.error("Cleanup API error:", error);
    return NextResponse.json(
      { success: false, error: "Cleanup failed" },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
