import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number | bigint): string {
  const numBytes = typeof bytes === "bigint" ? Number(bytes) : bytes;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  if (numBytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(numBytes) / Math.log(1024));
  return parseFloat((numBytes / Math.pow(1024, i)).toFixed(2)) + " " + sizes[i];
}

export function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, v) => (typeof v === "bigint" ? Number(v) : v))
  );
}
