"use client";

import { MatrixBackground } from "@/components/ui/matrix-shader";
import { TransferWizard } from "@/components/transfer/transfer-wizard";
import { Navbar } from "@/components/layout/navbar";

export default function Home() {
  return (
    <MatrixBackground>
      <Navbar />
      <main className="min-h-screen flex flex-col items-center justify-center py-12 pt-20">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white tracking-tight mb-3">
            Transfer
          </h1>
          <p className="text-neutral-400 text-lg">
            Share files securely with anyone. Up to 100GB per file.
          </p>
        </div>

        {/* Transfer Wizard */}
        <TransferWizard />
      </main>
    </MatrixBackground>
  );
}
