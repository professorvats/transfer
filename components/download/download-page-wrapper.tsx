"use client";

import { MatrixBackground } from "@/components/ui/matrix-shader";
import { DownloadPage } from "./download-page";

interface DownloadPageWrapperProps {
  transferId: string;
}

export function DownloadPageWrapper({ transferId }: DownloadPageWrapperProps) {
  return (
    <MatrixBackground>
      <main className="min-h-screen flex flex-col items-center justify-center py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white tracking-tight mb-3">
            Transfer
          </h1>
          <p className="text-neutral-400 text-lg">
            Download your files
          </p>
        </div>

        {/* Download Content */}
        <div className="w-full max-w-2xl px-4">
          <DownloadPage transferId={transferId} />
        </div>
      </main>
    </MatrixBackground>
  );
}
