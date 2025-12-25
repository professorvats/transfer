import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { verifyPassword, hashPassword } from "./password";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error("Invalid credentials");
        }

        const isValid = await verifyPassword(credentials.password, user.password);

        if (!isValid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
      }

      // Handle session updates
      if (trigger === "update" && session) {
        token.name = session.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Create a free subscription for new users
      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: "free",
          status: "active",
        },
      });
    },
  },
};

// Helper to get subscription limits
export const PLAN_LIMITS = {
  free: {
    maxTransferSize: 10 * 1024 * 1024 * 1024, // 10GB
    maxExpiryDays: 2,
    name: "Free",
  },
  unlimited: {
    maxTransferSize: Infinity,
    maxExpiryDays: 30,
    name: "Unlimited",
    price: 18, // $18/month
  },
};

export async function getUserSubscription(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  return subscription || { plan: "free", status: "active" };
}

export async function getUserPlanLimits(userId: string) {
  const subscription = await getUserSubscription(userId);
  const plan = subscription.plan as keyof typeof PLAN_LIMITS;
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}
