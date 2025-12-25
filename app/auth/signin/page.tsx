"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { MatrixBackground } from "@/components/ui/matrix-shader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  IconMail,
  IconLock,
  IconBrandGoogle,
  IconLoader2,
  IconSend,
} from "@tabler/icons-react";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid email or password");
      } else {
        toast.success("Signed in successfully!");
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      toast.error("Failed to sign in with Google");
      setGoogleLoading(false);
    }
  };

  return (
    <MatrixBackground>
      <main className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <Link href="/" className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <IconSend size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Transfer</span>
          </Link>

          {/* Card */}
          <div className="bg-black/50 backdrop-blur-md rounded-2xl border border-neutral-700 p-8">
            <h1 className="text-2xl font-bold text-white text-center mb-2">Welcome back</h1>
            <p className="text-neutral-400 text-center text-sm mb-8">
              Sign in to your account to continue
            </p>

            {/* Google Sign In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white text-black font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 mb-6"
            >
              {googleLoading ? (
                <IconLoader2 size={20} className="animate-spin" />
              ) : (
                <IconBrandGoogle size={20} />
              )}
              Continue with Google
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-black/50 px-2 text-neutral-500">or continue with email</span>
              </div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-neutral-300 flex items-center gap-2">
                  <IconMail size={14} />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="bg-neutral-800/50 border-neutral-700 text-white placeholder:text-neutral-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-neutral-300 flex items-center gap-2">
                  <IconLock size={14} />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="bg-neutral-800/50 border-neutral-700 text-white placeholder:text-neutral-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <IconLoader2 size={20} className="animate-spin" />
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* Sign Up Link */}
            <p className="text-center text-neutral-400 text-sm mt-6">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="text-blue-400 hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </motion.div>
      </main>
    </MatrixBackground>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <MatrixBackground>
        <main className="min-h-screen flex items-center justify-center">
          <IconLoader2 size={32} className="text-white animate-spin" />
        </main>
      </MatrixBackground>
    }>
      <SignInContent />
    </Suspense>
  );
}
