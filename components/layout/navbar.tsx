"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { motion } from "motion/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  IconUser,
  IconSettings,
  IconLogout,
  IconDashboard,
  IconCreditCard,
  IconSend,
} from "@tabler/icons-react";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <IconSend size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">Transfer</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/pricing"
              className="text-neutral-400 hover:text-white transition-colors text-sm"
            >
              Pricing
            </Link>
            {session && (
              <Link
                href="/dashboard"
                className="text-neutral-400 hover:text-white transition-colors text-sm"
              >
                Dashboard
              </Link>
            )}
          </div>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            {status === "loading" ? (
              <div className="w-8 h-8 rounded-full bg-neutral-800 animate-pulse" />
            ) : session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full p-1 hover:bg-neutral-800/50 transition-colors">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.user?.image || undefined} />
                      <AvatarFallback className="bg-neutral-700 text-neutral-200">
                        {session.user?.name?.charAt(0).toUpperCase() ||
                          session.user?.email?.charAt(0).toUpperCase() ||
                          "U"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-neutral-900 border-neutral-700"
                >
                  <DropdownMenuLabel className="text-neutral-200">
                    <div className="flex flex-col">
                      <span>{session.user?.name || "User"}</span>
                      <span className="text-xs text-neutral-500 font-normal">
                        {session.user?.email}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-neutral-700" />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2 cursor-pointer text-neutral-300 focus:bg-neutral-800 focus:text-white"
                    >
                      <IconDashboard size={16} />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dashboard/settings"
                      className="flex items-center gap-2 cursor-pointer text-neutral-300 focus:bg-neutral-800 focus:text-white"
                    >
                      <IconSettings size={16} />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/pricing"
                      className="flex items-center gap-2 cursor-pointer text-neutral-300 focus:bg-neutral-800 focus:text-white"
                    >
                      <IconCreditCard size={16} />
                      Subscription
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-neutral-700" />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="flex items-center gap-2 cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400"
                  >
                    <IconLogout size={16} />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="text-neutral-400 hover:text-white transition-colors text-sm"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-neutral-200 transition-colors"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
