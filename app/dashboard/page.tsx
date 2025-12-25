"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { MatrixBackground } from "@/components/ui/matrix-shader";
import { Navbar } from "@/components/layout/navbar";
import {
  IconCloudUpload,
  IconDownload,
  IconClock,
  IconFile,
  IconTrash,
  IconCopy,
  IconExternalLink,
  IconLoader2,
  IconSparkles,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Transfer {
  id: string;
  title: string | null;
  totalSize: number;
  downloadCount: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  files: { id: string; originalName: string }[];
}

interface DashboardData {
  transfers: Transfer[];
  stats: {
    totalTransfers: number;
    totalSize: number;
    totalDownloads: number;
  };
  subscription: {
    plan: string;
    status: string;
  };
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getDaysRemaining = (expiresAt: string) => {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days > 0 ? days : 0;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchDashboardData();
    }
  }, [session]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/dashboard");
      if (response.ok) {
        const data = await response.json();
        setData(data);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = (transferId: string) => {
    const url = `${window.location.origin}/download/${transferId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  const deleteTransfer = async (transferId: string) => {
    if (!confirm("Are you sure you want to delete this transfer?")) return;

    try {
      const response = await fetch(`/api/transfers/${transferId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Transfer deleted");
        fetchDashboardData();
      } else {
        toast.error("Failed to delete transfer");
      }
    } catch {
      toast.error("Failed to delete transfer");
    }
  };

  if (status === "loading" || loading) {
    return (
      <MatrixBackground>
        <Navbar />
        <main className="min-h-screen pt-24 flex items-center justify-center">
          <IconLoader2 size={32} className="text-white animate-spin" />
        </main>
      </MatrixBackground>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <MatrixBackground>
      <Navbar />
      <main className="min-h-screen pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, {session.user?.name || "User"}
            </h1>
            <p className="text-neutral-400">
              Manage your transfers and account settings
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          >
            <div className="bg-black/50 backdrop-blur-md rounded-xl border border-neutral-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <IconCloudUpload size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {data?.stats.totalTransfers || 0}
                  </p>
                  <p className="text-xs text-neutral-500">Transfers</p>
                </div>
              </div>
            </div>

            <div className="bg-black/50 backdrop-blur-md rounded-xl border border-neutral-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <IconFile size={20} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {formatBytes(Number(data?.stats.totalSize) || 0)}
                  </p>
                  <p className="text-xs text-neutral-500">Total Size</p>
                </div>
              </div>
            </div>

            <div className="bg-black/50 backdrop-blur-md rounded-xl border border-neutral-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <IconDownload size={20} className="text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">
                    {data?.stats.totalDownloads || 0}
                  </p>
                  <p className="text-xs text-neutral-500">Downloads</p>
                </div>
              </div>
            </div>

            <div className="bg-black/50 backdrop-blur-md rounded-xl border border-neutral-700 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <IconSparkles size={20} className="text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white capitalize">
                    {data?.subscription.plan || "Free"}
                  </p>
                  <p className="text-xs text-neutral-500">Plan</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Transfers List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Your Transfers</h2>
              <button
                onClick={() => router.push("/")}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                New Transfer
              </button>
            </div>

            {data?.transfers.length === 0 ? (
              <div className="bg-black/50 backdrop-blur-md rounded-xl border border-neutral-700 p-12 text-center">
                <IconCloudUpload size={48} className="text-neutral-600 mx-auto mb-4" />
                <p className="text-neutral-400 mb-4">No transfers yet</p>
                <button
                  onClick={() => router.push("/")}
                  className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors"
                >
                  Create your first transfer
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {data?.transfers.map((transfer, index) => {
                  const daysRemaining = getDaysRemaining(transfer.expiresAt);
                  const isExpired = daysRemaining === 0;

                  return (
                    <motion.div
                      key={transfer.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "bg-black/50 backdrop-blur-md rounded-xl border p-4 flex items-center justify-between gap-4",
                        isExpired ? "border-red-800/50" : "border-neutral-700"
                      )}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="p-2 rounded-lg bg-neutral-800">
                          <IconFile size={20} className="text-neutral-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">
                            {transfer.title || `Transfer ${transfer.id.slice(0, 8)}`}
                          </p>
                          <p className="text-neutral-500 text-sm">
                            {transfer.files.length} file{transfer.files.length !== 1 && "s"} ·{" "}
                            {formatBytes(Number(transfer.totalSize))} ·{" "}
                            {formatDate(transfer.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Stats */}
                        <div className="hidden md:flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1 text-neutral-400">
                            <IconDownload size={14} />
                            <span>{transfer.downloadCount}</span>
                          </div>
                          <div
                            className={cn(
                              "flex items-center gap-1",
                              isExpired ? "text-red-400" : daysRemaining <= 2 ? "text-yellow-400" : "text-neutral-400"
                            )}
                          >
                            <IconClock size={14} />
                            <span>{isExpired ? "Expired" : `${daysRemaining}d left`}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyLink(transfer.id)}
                            className="p-2 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white"
                            title="Copy link"
                          >
                            <IconCopy size={18} />
                          </button>
                          <a
                            href={`/download/${transfer.id}`}
                            target="_blank"
                            className="p-2 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white"
                            title="Open"
                          >
                            <IconExternalLink size={18} />
                          </a>
                          <button
                            onClick={() => deleteTransfer(transfer.id)}
                            className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-neutral-400 hover:text-red-400"
                            title="Delete"
                          >
                            <IconTrash size={18} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </MatrixBackground>
  );
}
