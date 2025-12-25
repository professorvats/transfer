"use client";

import { useState, useCallback, useRef } from "react";
import * as tus from "tus-js-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatBytes } from "@/lib/utils";

type Step = "files" | "details" | "uploading" | "success";

interface FileItem {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
}

interface TransferDetails {
  title: string;
  message: string;
  senderEmail: string;
  recipientEmails: string;
  password: string;
  expiresInDays: number;
}

interface TransferResponse {
  id: string;
  download_url: string;
  file_count: number;
  total_size: number;
  expires_at: string;
}

export function UploadWizard() {
  const [step, setStep] = useState<Step>("files");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [transferResult, setTransferResult] = useState<TransferResponse | null>(null);
  const [details, setDetails] = useState<TransferDetails>({
    title: "",
    message: "",
    senderEmail: "",
    recipientEmails: "",
    password: "",
    expiresInDays: 7,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadAbortRef = useRef<(() => void)[]>([]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: FileItem[] = Array.from(selectedFiles).map((file) => ({
      file,
      id: crypto.randomUUID(),
      progress: 0,
      status: "pending" as const,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles) return;

    const newFiles: FileItem[] = Array.from(droppedFiles).map((file) => ({
      file,
      id: crypto.randomUUID(),
      progress: 0,
      status: "pending" as const,
    }));

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleContinueToDetails = useCallback(() => {
    if (files.length === 0) {
      toast.error("Please add at least one file");
      return;
    }
    setStep("details");
  }, [files.length]);

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
          setFiles((prev) =>
            prev.map((f) => (f.id === fileItem.id ? { ...f, status: "error" } : f))
          );
          reject(error);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const progress = Math.round((bytesUploaded / bytesTotal) * 100);
          setFiles((prev) =>
            prev.map((f) => (f.id === fileItem.id ? { ...f, progress } : f))
          );
        },
        onSuccess: () => {
          setFiles((prev) =>
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
    try {
      const recipientEmailsArray = details.recipientEmails
        .split(",")
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && e.includes("@"));

      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: details.title || undefined,
          message: details.message || undefined,
          sender_email: details.senderEmail || undefined,
          recipient_emails: recipientEmailsArray.length > 0 ? recipientEmailsArray : undefined,
          password: details.password || undefined,
          expires_in_days: details.expiresInDays,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create transfer");
      }

      const data = await response.json();
      setStep("uploading");

      let completed = 0;
      for (const fileItem of files) {
        setFiles((prev) =>
          prev.map((f) => (f.id === fileItem.id ? { ...f, status: "uploading" } : f))
        );

        try {
          await uploadFile(fileItem, data.id);
          completed++;
          setOverallProgress(Math.round((completed / files.length) * 100));
        } catch (error) {
          console.error(`Failed to upload ${fileItem.file.name}:`, error);
          toast.error(`Failed to upload ${fileItem.file.name}`);
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
    }
  }, [details, files]);

  const handleCopyLink = useCallback(() => {
    if (transferResult?.download_url) {
      navigator.clipboard.writeText(transferResult.download_url);
      toast.success("Link copied to clipboard!");
    }
  }, [transferResult]);

  const handleSendMore = useCallback(() => {
    setStep("files");
    setFiles([]);
    setOverallProgress(0);
    setTransferResult(null);
    setDetails({
      title: "",
      message: "",
      senderEmail: "",
      recipientEmails: "",
      password: "",
      expiresInDays: 7,
    });
    uploadAbortRef.current = [];
  }, []);

  const totalSize = files.reduce((sum, f) => sum + f.file.size, 0);

  if (step === "files") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add Files</CardTitle>
          <CardDescription>Drop files or click to browse. Up to 100GB per file.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              hidden
            />
            <Card>
              <CardContent>
                <p>Drop files here or click to browse</p>
              </CardContent>
            </Card>
          </div>

          {files.length > 0 && (
            <>
              <Separator />
              <p>{files.length} file(s) - {formatBytes(totalSize)}</p>
              {files.map((fileItem) => (
                <Card key={fileItem.id}>
                  <CardHeader>
                    <CardTitle>{fileItem.file.name}</CardTitle>
                    <CardDescription>{formatBytes(fileItem.file.size)}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button variant="destructive" size="sm" onClick={() => removeFile(fileItem.id)}>
                      Remove
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleContinueToDetails}>Continue</Button>
        </CardFooter>
      </Card>
    );
  }

  if (step === "details") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transfer Details</CardTitle>
          <CardDescription>Configure your transfer options</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="senderEmail">Your Email (optional)</Label>
          <Input
            id="senderEmail"
            type="email"
            placeholder="your@email.com"
            value={details.senderEmail}
            onChange={(e) => setDetails({ ...details, senderEmail: e.target.value })}
          />

          <Label htmlFor="recipientEmails">Recipient Emails (optional)</Label>
          <Input
            id="recipientEmails"
            type="text"
            placeholder="friend@email.com"
            value={details.recipientEmails}
            onChange={(e) => setDetails({ ...details, recipientEmails: e.target.value })}
          />

          <Separator />

          <Label htmlFor="title">Title (optional)</Label>
          <Input
            id="title"
            type="text"
            placeholder="My Transfer"
            value={details.title}
            onChange={(e) => setDetails({ ...details, title: e.target.value })}
          />

          <Label htmlFor="message">Message (optional)</Label>
          <Textarea
            id="message"
            placeholder="Add a message..."
            value={details.message}
            onChange={(e) => setDetails({ ...details, message: e.target.value })}
          />

          <Separator />

          <Label htmlFor="password">Password (optional)</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter a password"
            value={details.password}
            onChange={(e) => setDetails({ ...details, password: e.target.value })}
          />

          <Label>Expires In</Label>
          <RadioGroup
            value={String(details.expiresInDays)}
            onValueChange={(value) => setDetails({ ...details, expiresInDays: parseInt(value) })}
          >
            {[1, 3, 7, 14, 30].map((days) => (
              <div key={days}>
                <RadioGroupItem value={String(days)} id={`days-${days}`} />
                <Label htmlFor={`days-${days}`}>{days} {days === 1 ? "day" : "days"}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={() => setStep("files")}>Back</Button>
          <Button onClick={handleStartTransfer}>Transfer</Button>
        </CardFooter>
      </Card>
    );
  }

  if (step === "uploading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Uploading...</CardTitle>
          <CardDescription>Please keep this page open</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Overall Progress: {overallProgress}%</p>
          <Progress value={overallProgress} />

          {files.map((fileItem) => (
            <Card key={fileItem.id}>
              <CardHeader>
                <CardTitle>{fileItem.file.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge
                  variant={
                    fileItem.status === "complete"
                      ? "default"
                      : fileItem.status === "error"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {fileItem.status === "complete"
                    ? "Done"
                    : fileItem.status === "error"
                      ? "Error"
                      : fileItem.status === "uploading"
                        ? `${fileItem.progress}%`
                        : "Waiting"}
                </Badge>
                {fileItem.status === "uploading" && <Progress value={fileItem.progress} />}
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (step === "success" && transferResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transfer Complete!</CardTitle>
          <CardDescription>Your files are ready to share</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Files: {transferResult.file_count}</p>
          <p>Size: {formatBytes(transferResult.total_size)}</p>
          <p>Expires: {new Date(transferResult.expires_at).toLocaleDateString()}</p>

          <Separator />

          <Label>Download Link</Label>
          <Input type="text" readOnly value={transferResult.download_url} />
          <Button onClick={handleCopyLink}>Copy Link</Button>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={handleSendMore}>Send More Files</Button>
        </CardFooter>
      </Card>
    );
  }

  return null;
}
