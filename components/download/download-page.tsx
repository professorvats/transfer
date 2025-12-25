"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  IconDownload,
  IconFileZip,
  IconLock,
  IconAlertTriangle,
  IconFile,
  IconUser,
  IconClock,
  IconLoader2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface FileInfo {
  id: string;
  original_name: string;
  size: number;
  mime_type: string;
}

interface TransferData {
  id: string;
  title: string | null;
  message: string | null;
  sender_email: string | null;
  expires_at: string;
  created_at: string;
  download_count: number;
  total_size: number;
  status: string;
  has_password: boolean;
  files: FileInfo[];
}

interface DownloadPageProps {
  transferId: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export function DownloadPage({ transferId }: DownloadPageProps) {
  const [transfer, setTransfer] = useState<TransferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchTransfer();
  }, [transferId]);

  async function fetchTransfer() {
    try {
      const response = await fetch(`/api/transfers/${transferId}`);

      if (response.status === 404) {
        setError("Transfer not found");
        return;
      }

      if (response.status === 410) {
        setError("This transfer has expired or been deleted");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch transfer");
      }

      const data = await response.json();
      setTransfer(data);

      if (data.has_password) {
        setShowPasswordDialog(true);
      } else {
        setPasswordVerified(true);
      }
    } catch (err) {
      setError("Failed to load transfer");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyPassword() {
    try {
      const response = await fetch(`/api/transfers/${transferId}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setPasswordVerified(true);
          setShowPasswordDialog(false);
        } else {
          toast.error("Incorrect password");
        }
      } else {
        toast.error("Incorrect password");
      }
    } catch (err) {
      toast.error("Failed to verify password");
      console.error(err);
    }
  }

  async function handleDownloadFile(file: FileInfo) {
    setDownloading(file.id);
    try {
      const url = `/api/transfers/${transferId}/download/${file.id}${
        password ? `?password=${encodeURIComponent(password)}` : ""
      }`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast.success(`Downloaded ${file.original_name}`);
    } catch (err) {
      toast.error("Download failed");
      console.error(err);
    } finally {
      setDownloading(null);
    }
  }

  async function handleDownloadAll() {
    setDownloading("all");
    try {
      const url = `/api/transfers/${transferId}/download-all${
        password ? `?password=${encodeURIComponent(password)}` : ""
      }`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Download failed");
      }

      const blob = await response.blob();
      const filename =
        response.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") ||
        "transfer.zip";
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast.success("Download complete");
    } catch (err) {
      toast.error("Download failed");
      console.error(err);
    } finally {
      setDownloading(null);
    }
  }

  // Single fixed-size card container
  return (
    <>
      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="bg-neutral-900 border-neutral-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <IconLock size={20} />
              Password Protected
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              This transfer is password protected. Enter the password to view files.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="password" className="text-neutral-300">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyPassword()}
              className="mt-2 bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500"
            />
          </div>
          <DialogFooter>
            <button
              onClick={handleVerifyPassword}
              className="w-full h-10 rounded-lg bg-white text-black font-medium hover:bg-neutral-200 transition-colors"
            >
              Unlock
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Card */}
      <div className="bg-black/50 backdrop-blur-md rounded-2xl border border-neutral-700 shadow-xl overflow-hidden min-h-[480px]">
        <AnimatePresence mode="wait">
          {/* Loading State */}
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <div className="space-y-4">
                <Skeleton className="h-8 w-48 bg-neutral-700" />
                <Skeleton className="h-4 w-32 bg-neutral-700" />
                <div className="space-y-2 mt-6">
                  <Skeleton className="h-16 w-full bg-neutral-700" />
                  <Skeleton className="h-16 w-full bg-neutral-700" />
                </div>
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {!loading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-900/50 mb-4">
                  <IconAlertTriangle size={32} className="text-red-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">Transfer Unavailable</h2>
                <p className="text-neutral-400">{error}</p>
                <p className="text-neutral-500 text-sm mt-4">
                  The link may have expired or the transfer was deleted.
                </p>
              </div>
            </motion.div>
          )}

          {/* Content State */}
          {!loading && !error && transfer && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              {/* Header */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {transfer.title || "File Transfer"}
                </h2>
                {transfer.sender_email && (
                  <p className="text-neutral-400 flex items-center gap-2 mt-1 text-sm">
                    <IconUser size={14} />
                    From: {transfer.sender_email}
                  </p>
                )}
              </div>

              {/* Message */}
              {transfer.message && (
                <div className="p-4 bg-neutral-900/50 rounded-xl border border-neutral-700 mb-6">
                  <p className="text-neutral-300 text-sm">{transfer.message}</p>
                </div>
              )}

              {/* Stats */}
              {(() => {
                const expiresAt = new Date(transfer.expires_at);
                const daysRemaining = Math.ceil(
                  (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-3 bg-neutral-900/50 rounded-xl text-center border border-neutral-700">
                        <p className="text-xl font-bold text-white">{transfer.files.length}</p>
                        <p className="text-xs text-neutral-400">Files</p>
                      </div>
                      <div className="p-3 bg-neutral-900/50 rounded-xl text-center border border-neutral-700">
                        <p className="text-xl font-bold text-white">{formatBytes(transfer.total_size)}</p>
                        <p className="text-xs text-neutral-400">Total Size</p>
                      </div>
                      <div className="p-3 bg-neutral-900/50 rounded-xl text-center border border-neutral-700">
                        <p className={cn(
                          "text-xl font-bold",
                          daysRemaining <= 2 ? "text-red-400" : "text-white"
                        )}>
                          {daysRemaining}d
                        </p>
                        <p className="text-xs text-neutral-400">
                          {daysRemaining <= 2 ? "Expires soon" : "Remaining"}
                        </p>
                      </div>
                    </div>

                    {/* Expiry Warning */}
                    {daysRemaining <= 2 && (
                      <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg mb-6">
                        <IconClock size={16} className="text-red-400" />
                        <p className="text-sm text-red-300">
                          This transfer expires in {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Files List */}
              {passwordVerified && (
                <div className="space-y-3 max-h-[240px] overflow-y-auto scrollbar-dark">
                  {transfer.files.map((file, index) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 bg-neutral-900/50 rounded-lg border border-neutral-700 flex items-center justify-between hover:bg-neutral-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-neutral-800 rounded-lg border border-neutral-600">
                          <IconFile size={20} className="text-neutral-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium truncate max-w-[200px]">
                            {file.original_name}
                          </p>
                          <p className="text-neutral-400 text-sm">{formatBytes(file.size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadFile(file)}
                        disabled={downloading === file.id}
                        className={cn(
                          "px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all",
                          downloading === file.id
                            ? "bg-neutral-700 text-neutral-500 cursor-wait"
                            : "bg-white text-black hover:bg-neutral-200"
                        )}
                      >
                        {downloading === file.id ? (
                          <IconLoader2 size={16} className="animate-spin" />
                        ) : (
                          <IconDownload size={16} />
                        )}
                        {downloading === file.id ? "..." : "Download"}
                      </button>
                    </motion.div>
                  ))}

                  {/* Download All Button */}
                  {transfer.files.length > 1 && (
                    <div className="pt-4">
                      <button
                        onClick={handleDownloadAll}
                        disabled={downloading === "all"}
                        className={cn(
                          "w-full h-12 rounded-xl font-medium flex items-center justify-center gap-2 transition-all",
                          downloading === "all"
                            ? "bg-neutral-700 text-neutral-500 cursor-wait"
                            : "bg-white text-black hover:bg-neutral-200"
                        )}
                      >
                        {downloading === "all" ? (
                          <IconLoader2 size={18} className="animate-spin" />
                        ) : (
                          <IconFileZip size={18} />
                        )}
                        {downloading === "all" ? "Preparing ZIP..." : "Download All as ZIP"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Password Prompt */}
              {!passwordVerified && transfer.has_password && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-800 mb-4">
                    <IconLock size={24} className="text-neutral-400" />
                  </div>
                  <p className="text-neutral-400 mb-4">
                    Enter the password to view and download files.
                  </p>
                  <button
                    onClick={() => setShowPasswordDialog(true)}
                    className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-neutral-200 transition-colors"
                  >
                    Enter Password
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
