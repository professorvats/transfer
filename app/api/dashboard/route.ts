import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch user's transfers
    const transfers = await prisma.transfer.findMany({
      where: { userId },
      include: {
        files: {
          select: {
            id: true,
            originalName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Calculate stats
    const stats = {
      totalTransfers: transfers.length,
      totalSize: transfers.reduce((sum, t) => sum + Number(t.totalSize), 0),
      totalDownloads: transfers.reduce((sum, t) => sum + t.downloadCount, 0),
    };

    // Get subscription
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    return NextResponse.json({
      transfers: transfers.map((t) => ({
        id: t.id,
        title: t.title,
        totalSize: Number(t.totalSize),
        downloadCount: t.downloadCount,
        status: t.status,
        expiresAt: t.expiresAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
        files: t.files,
      })),
      stats,
      subscription: subscription || { plan: "free", status: "active" },
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
