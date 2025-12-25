"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import * as tus from "tus-js-client";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  IconCopy,
  IconCheck,
  IconLock,
  IconClock,
  IconMail,
  IconSend,
  IconFile,
  IconFolder,
  IconX,
  IconChevronUp,
  IconChevronDown,
  IconDots,
  IconCalendar,
  IconLink,
  IconUser,
  IconBolt,
  IconCloudUpload,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

type Step = "upload" | "uploading" | "success";
type TransferType = "email" | "link";

interface FileItem {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  speed?: number;
}

interface TransferDetails {
  password: string;
  expiresInDays: number;
  recipientEmail: string;
  senderEmail: string;
  title: string;
  message: string;
  transferType: TransferType;
  customLink: string;
}

interface TransferResponse {
  id: string;
  download_url: string;
  file_count: number;
  total_size: number;
  expires_at: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond === 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const EXPIRY_OPTIONS = [
  { value: 1, label: "1 day" },
  { value: 3, label: "3 days" },
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
];

// Circular Progress Component
function CircularProgress({ progress, size = 48, strokeWidth = 4 }: { progress: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background circle */}
      <svg className="absolute transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(115, 115, 115, 0.3)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-300 ease-out"
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-white">{progress}%</span>
      </div>
    </div>
  );
}

export function TransferWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [transferResult, setTransferResult] = useState<TransferResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [details, setDetails] = useState<TransferDetails>({
    password: "",
    expiresInDays: 7,
    recipientEmail: "",
    senderEmail: "",
    title: "",
    message: "",
    transferType: "link",
    customLink: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<(() => void)[]>([]);
  const lastBytesRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  // Timer for elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === "uploading" && uploadStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - uploadStartTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, uploadStartTime]);

  const handleFilesChange = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleFileRemove = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadFile = async (fileItem: FileItem, tid: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(fileItem.file, {
        endpoint: "/api/tus",
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: 50 * 1024 * 1024,
        metadata: {
          transferId: tid,
          filename: fileItem.file.name,
          filetype: fileItem.file.type || "application/octet-stream",
        },
        onError: (error) => {
          setFileItems((prev) =>
            prev.map((f) => (f.id === fileItem.id ? { ...f, status: "error" } : f))
          );
          reject(error);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const progress = Math.round((bytesUploaded / bytesTotal) * 100);

          // Calculate speed
          const now = Date.now();
          const timeDiff = (now - lastTimeRef.current) / 1000;
          if (timeDiff >= 0.5) {
            const bytesDiff = bytesUploaded - lastBytesRef.current;
            const speed = bytesDiff / timeDiff;
            setUploadSpeed(speed);
            lastBytesRef.current = bytesUploaded;
            lastTimeRef.current = now;
          }

          setFileItems((prev) =>
            prev.map((f) => (f.id === fileItem.id ? { ...f, progress } : f))
          );
        },
        onSuccess: () => {
          setFileItems((prev) =>
            prev.map((f) =>
              f.id === fileItem.id ? { ...f, status: "complete", progress: 100 } : f
            )
          );
          resolve();
        },
      });

      uploadAbortRef.current.push(() => upload.abort());
      upload.start();
    });
  };

  const handleStartTransfer = useCallback(async () => {
    if (files.length === 0) {
      toast.error("Please add at least one file");
      return;
    }

    if (details.transferType === "email") {
      if (!details.recipientEmail) {
        toast.error("Please enter recipient email");
        setDrawerOpen(true);
        return;
      }
      if (!details.senderEmail) {
        toast.error("Please enter your email");
        setDrawerOpen(true);
        return;
      }
    }

    try {
      const items: FileItem[] = files.map((file) => ({
        file,
        id: crypto.randomUUID(),
        progress: 0,
        status: "pending" as const,
      }));
      setFileItems(items);
      setStep("uploading");
      setUploadStartTime(Date.now());
      lastBytesRef.current = 0;
      lastTimeRef.current = Date.now();

      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: details.password || undefined,
          expires_in_days: details.expiresInDays,
          recipient_emails: details.recipientEmail ? [details.recipientEmail] : undefined,
          sender_email: details.senderEmail || undefined,
          title: details.title || undefined,
          message: details.message || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create transfer");
      }

      const data = await response.json();

      let completed = 0;
      for (const item of items) {
        setFileItems((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, status: "uploading" } : f))
        );

        try {
          await uploadFile(item, data.id);
          completed++;
          setOverallProgress(Math.round((completed / items.length) * 100));
        } catch (error) {
          console.error(`Failed to upload ${item.file.name}:`, error);
          toast.error(`Failed to upload ${item.file.name}`);
        }
      }

      const completeResponse = await fetch(`/api/transfers/${data.id}/complete`, {
        method: "POST",
      });

      if (completeResponse.ok) {
        const result = await completeResponse.json();
        setTransferResult(result);
        setStep("success");
      } else {
        throw new Error("Failed to complete transfer");
      }
    } catch (error) {
      toast.error("Failed to start transfer");
      console.error(error);
      setStep("upload");
    }
  }, [files, details]);

  const handleCopyLink = useCallback(() => {
    if (transferResult?.download_url) {
      navigator.clipboard.writeText(transferResult.download_url);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [transferResult]);

  const handleSendMore = useCallback(() => {
    setStep("upload");
    setFiles([]);
    setFileItems([]);
    setOverallProgress(0);
    setTransferResult(null);
    setDrawerOpen(false);
    setUploadSpeed(0);
    setElapsedTime(0);
    setUploadStartTime(null);
    setDetails({
      password: "",
      expiresInDays: 7,
      recipientEmail: "",
      senderEmail: "",
      title: "",
      message: "",
      transferType: "link",
      customLink: "",
    });
    uploadAbortRef.current = [];
  }, []);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const currentExpiry = EXPIRY_OPTIONS.find((o) => o.value === details.expiresInDays);

  // Calculate current uploading file
  const currentFile = fileItems.find(f => f.status === "uploading");
  const completedFiles = fileItems.filter(f => f.status === "complete").length;

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleFilesChange(Array.from(e.target.files));
            e.target.value = "";
          }
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error - webkitdirectory is not standard but widely supported
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            handleFilesChange(Array.from(e.target.files));
            e.target.value = "";
          }
        }}
      />

      {/* Main Card */}
      <div className="relative bg-black/50 backdrop-blur-md rounded-2xl border border-neutral-700 shadow-xl overflow-hidden">
        <div className="flex">
          {/* Main Content */}
          <div className={cn(
            "flex-1 transition-all duration-300 min-w-0",
            drawerOpen && step === "upload" ? "max-w-[calc(100%-280px)]" : "w-full"
          )}>
            {/* Upload Area - Transforms based on step */}
            <div className="p-6 border-b border-neutral-700/50">
              <AnimatePresence mode="wait">
                {step === "upload" && files.length === 0 && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-4 justify-center py-8"
                  >
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-neutral-600 hover:border-neutral-400 hover:bg-neutral-800/30 transition-all min-w-[140px]"
                    >
                      <div className="p-3 rounded-full bg-neutral-800 group-hover:bg-neutral-700 transition-colors">
                        <IconFile size={24} className="text-neutral-300" />
                      </div>
                      <span className="text-neutral-200 font-medium">Add files</span>
                    </button>
                    <button
                      onClick={() => folderInputRef.current?.click()}
                      className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-neutral-600 hover:border-neutral-400 hover:bg-neutral-800/30 transition-all min-w-[140px]"
                    >
                      <div className="p-3 rounded-full bg-neutral-800 group-hover:bg-neutral-700 transition-colors">
                        <IconFolder size={24} className="text-neutral-300" />
                      </div>
                      <span className="text-neutral-200 font-medium">Add folder</span>
                    </button>
                  </motion.div>
                )}

                {step === "upload" && files.length > 0 && (
                  <motion.div
                    key="files"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-dark">
                      {files.map((file, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <IconFile size={18} className="text-neutral-400 shrink-0" />
                            <span className="text-neutral-200 text-sm truncate">{file.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-neutral-500 text-xs">{formatBytes(file.size)}</span>
                            <button
                              onClick={() => handleFileRemove(idx)}
                              className="p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-neutral-700 transition-all"
                            >
                              <IconX size={14} className="text-neutral-400" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30 rounded-lg transition-colors"
                      >
                        + Add more files
                      </button>
                    </div>
                    <div className="mt-3 text-center text-sm text-neutral-500">
                      {files.length} file{files.length > 1 ? "s" : ""} · {formatBytes(totalSize)}
                    </div>
                  </motion.div>
                )}

                {(step === "uploading" || step === "success") && (
                  <motion.div
                    key="progress"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="py-4"
                  >
                    {/* Progress Circle + Stats Row */}
                    <div className="flex items-center justify-between">
                      {/* Left: Progress Circle */}
                      <div className="flex items-center gap-4">
                        <motion.div
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200 }}
                        >
                          {step === "uploading" ? (
                            <CircularProgress progress={overallProgress} size={56} strokeWidth={5} />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", delay: 0.1 }}
                              >
                                <IconCheck size={28} className="text-green-400" />
                              </motion.div>
                            </div>
                          )}
                        </motion.div>
                        <div>
                          <p className="text-white font-medium">
                            {step === "uploading"
                              ? `Uploading ${completedFiles + 1} of ${fileItems.length}...`
                              : "Transfer Complete!"
                            }
                          </p>
                          <p className="text-neutral-400 text-sm">
                            {step === "uploading" && currentFile
                              ? currentFile.file.name
                              : `${fileItems.length} files · ${formatBytes(totalSize)}`
                            }
                          </p>
                        </div>
                      </div>

                      {/* Right: Speed Stats */}
                      <div className="flex items-center gap-4">
                        {step === "uploading" && (
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20"
                          >
                            <IconBolt size={16} className="text-blue-400" />
                            <span className="text-blue-400 text-sm font-medium">{formatSpeed(uploadSpeed)}</span>
                          </motion.div>
                        )}
                        <div className="text-right">
                          <p className="text-neutral-400 text-xs">
                            {step === "uploading" ? "Elapsed" : "Completed in"}
                          </p>
                          <p className="text-white text-sm font-medium">{elapsedTime}s</p>
                        </div>
                      </div>
                    </div>

                    {/* File Progress List (compact) */}
                    {step === "uploading" && fileItems.length > 1 && (
                      <div className="mt-4 space-y-1 max-h-[100px] overflow-y-auto scrollbar-dark">
                        {fileItems.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-xs">
                            <div className="flex-1 truncate text-neutral-400">{item.file.name}</div>
                            <div className={cn(
                              "w-12 text-right",
                              item.status === "complete" && "text-green-400",
                              item.status === "uploading" && "text-blue-400",
                              item.status === "pending" && "text-neutral-500",
                              item.status === "error" && "text-red-400"
                            )}>
                              {item.status === "complete" ? "Done" :
                               item.status === "uploading" ? `${item.progress}%` :
                               item.status === "error" ? "Error" : "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Success Stats Grid */}
                    {step === "success" && transferResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mt-4 grid grid-cols-4 gap-2"
                      >
                        <div className="p-2 bg-neutral-800/50 rounded-lg text-center">
                          <p className="text-lg font-bold text-white">{transferResult.file_count}</p>
                          <p className="text-[10px] text-neutral-500">Files</p>
                        </div>
                        <div className="p-2 bg-neutral-800/50 rounded-lg text-center">
                          <p className="text-lg font-bold text-white">{formatBytes(transferResult.total_size)}</p>
                          <p className="text-[10px] text-neutral-500">Size</p>
                        </div>
                        <div className="p-2 bg-neutral-800/50 rounded-lg text-center">
                          <p className="text-lg font-bold text-blue-400">{elapsedTime}s</p>
                          <p className="text-[10px] text-neutral-500">Time</p>
                        </div>
                        <div className="p-2 bg-neutral-800/50 rounded-lg text-center">
                          <p className="text-lg font-bold text-green-400">
                            {elapsedTime > 0 ? formatSpeed(transferResult.total_size / elapsedTime) : "—"}
                          </p>
                          <p className="text-[10px] text-neutral-500">Avg Speed</p>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Title & Message - Only in upload step */}
            {step === "upload" && (
              <div className="p-6 space-y-4 border-b border-neutral-700/50">
                <div className="space-y-1">
                  <label className="text-xs text-neutral-500">Title</label>
                  <input
                    type="text"
                    placeholder="Add a title"
                    value={details.title}
                    onChange={(e) => setDetails({ ...details, title: e.target.value })}
                    className="w-full bg-transparent border-b border-neutral-700 pb-2 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-neutral-500">Message</label>
                  <textarea
                    placeholder="Add a message"
                    value={details.message}
                    onChange={(e) => setDetails({ ...details, message: e.target.value })}
                    rows={2}
                    className="w-full bg-transparent border-b border-neutral-700 pb-2 text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors resize-none"
                  />
                </div>
              </div>
            )}

            {/* Link Display - Only in success step */}
            {step === "success" && transferResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 space-y-3 border-b border-neutral-700/50"
              >
                {details.password && (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <IconLock size={14} />
                    <span>Password protected</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={transferResult.download_url}
                    className="bg-neutral-800 border-neutral-600 text-neutral-200 text-sm"
                  />
                </div>
              </motion.div>
            )}

            {/* Footer - Button transforms */}
            <div className="p-4 flex items-center justify-between gap-4">
              {/* Left side */}
              <div className="relative">
                {step === "upload" && (
                  <button
                    onClick={() => setExpiryOpen(!expiryOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-800/50 transition-colors text-neutral-300"
                  >
                    <IconCalendar size={18} />
                    <span className="text-sm">{currentExpiry?.label}</span>
                    {expiryOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                  </button>
                )}
                {step === "uploading" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 px-3 py-2 text-neutral-400"
                  >
                    <IconCloudUpload size={18} className="animate-pulse" />
                    <span className="text-sm">Uploading...</span>
                  </motion.div>
                )}
                {step === "success" && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={handleSendMore}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-800/50 transition-colors text-neutral-400 hover:text-neutral-200"
                  >
                    <IconSend size={18} />
                    <span className="text-sm">Send more</span>
                  </motion.button>
                )}

                <AnimatePresence>
                  {expiryOpen && step === "upload" && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute bottom-full left-0 mb-2 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl overflow-hidden z-10"
                    >
                      {EXPIRY_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setDetails({ ...details, expiresInDays: option.value });
                            setExpiryOpen(false);
                          }}
                          className={cn(
                            "w-full px-4 py-2 text-left text-sm hover:bg-neutral-700 transition-colors",
                            details.expiresInDays === option.value
                              ? "text-white bg-neutral-700"
                              : "text-neutral-300"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Right side - Main action button */}
              <div className="flex items-center gap-2">
                {step === "upload" && (
                  <>
                    <button
                      onClick={() => setDrawerOpen(!drawerOpen)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        drawerOpen ? "bg-neutral-700 text-white" : "hover:bg-neutral-800/50 text-neutral-400"
                      )}
                    >
                      <IconDots size={20} />
                    </button>
                    <motion.button
                      onClick={handleStartTransfer}
                      disabled={files.length === 0}
                      className={cn(
                        "px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all",
                        files.length === 0
                          ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
                          : "bg-white text-black hover:bg-neutral-200"
                      )}
                      whileHover={files.length > 0 ? { scale: 1.02 } : {}}
                      whileTap={files.length > 0 ? { scale: 0.98 } : {}}
                    >
                      <IconSend size={18} />
                      Transfer
                    </motion.button>
                  </>
                )}

                {step === "uploading" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 bg-neutral-700 text-neutral-300"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    >
                      <IconCloudUpload size={18} />
                    </motion.div>
                    {overallProgress}%
                  </motion.div>
                )}

                {step === "success" && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={handleCopyLink}
                    className={cn(
                      "px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all",
                      copied
                        ? "bg-green-500 text-white"
                        : "bg-white text-black hover:bg-neutral-200"
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
                    {copied ? "Copied!" : "Copy Link"}
                  </motion.button>
                )}
              </div>
            </div>
          </div>

          {/* Options Drawer - Only in upload step */}
          <AnimatePresence>
            {drawerOpen && step === "upload" && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 280, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-l border-neutral-700/50 bg-neutral-900/50 overflow-hidden shrink-0"
              >
                <div className="p-4 w-[280px] h-full overflow-y-auto scrollbar-dark">
                  <h3 className="text-neutral-200 font-medium mb-4">Options</h3>

                  {/* Transfer Type */}
                  <div className="mb-4">
                    <p className="text-xs text-neutral-500 mb-2">Transfer type</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDetails({ ...details, transferType: "email" })}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors",
                          details.transferType === "email"
                            ? "bg-neutral-700 text-white"
                            : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800"
                        )}
                      >
                        <IconMail size={16} />
                        Email
                      </button>
                      <button
                        onClick={() => setDetails({ ...details, transferType: "link" })}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors",
                          details.transferType === "link"
                            ? "bg-neutral-700 text-white"
                            : "bg-neutral-800/50 text-neutral-400 hover:bg-neutral-800"
                        )}
                      >
                        <IconLink size={16} />
                        Link
                      </button>
                    </div>
                  </div>

                  <div className="h-px bg-neutral-700/50 my-4" />

                  {details.transferType === "email" && (
                    <>
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <IconMail size={14} className="text-neutral-500" />
                          <label className="text-xs text-neutral-500">Email to</label>
                        </div>
                        <input
                          type="email"
                          placeholder="recipient@email.com"
                          value={details.recipientEmail}
                          onChange={(e) => setDetails({ ...details, recipientEmail: e.target.value })}
                          className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                        />
                      </div>
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <IconUser size={14} className="text-neutral-500" />
                          <label className="text-xs text-neutral-500">Your email</label>
                        </div>
                        <input
                          type="email"
                          placeholder="your@email.com"
                          value={details.senderEmail}
                          onChange={(e) => setDetails({ ...details, senderEmail: e.target.value })}
                          className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                        />
                      </div>
                      <div className="h-px bg-neutral-700/50 my-4" />
                    </>
                  )}

                  {details.transferType === "link" && (
                    <>
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <IconLink size={14} className="text-neutral-500" />
                          <label className="text-xs text-neutral-500">Custom link (optional)</label>
                        </div>
                        <div className="flex items-center bg-neutral-800/50 border border-neutral-700 rounded-lg overflow-hidden">
                          <span className="px-3 py-2 text-xs text-neutral-500 bg-neutral-800 border-r border-neutral-700">
                            /download/
                          </span>
                          <input
                            type="text"
                            placeholder="my-files"
                            value={details.customLink}
                            onChange={(e) => setDetails({ ...details, customLink: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                            className="flex-1 bg-transparent px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="h-px bg-neutral-700/50 my-4" />
                    </>
                  )}

                  {/* Password */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <IconLock size={14} className="text-neutral-500" />
                      <label className="text-xs text-neutral-500">Password protection</label>
                    </div>
                    <input
                      type="password"
                      placeholder="Set password (optional)"
                      value={details.password}
                      onChange={(e) => setDetails({ ...details, password: e.target.value })}
                      className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                    />
                    {details.password && (
                      <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                        <IconCheck size={12} />
                        Password will be encrypted
                      </p>
                    )}
                  </div>

                  <div className="h-px bg-neutral-700/50 my-4" />

                  <div className="flex items-center gap-2 text-neutral-400 text-sm">
                    <IconClock size={16} />
                    <span>Expires in {currentExpiry?.label}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
