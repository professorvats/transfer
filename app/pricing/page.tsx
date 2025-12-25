"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { MatrixBackground } from "@/components/ui/matrix-shader";
import { Navbar } from "@/components/layout/navbar";
import {
  IconCheck,
  IconBolt,
  IconInfinity,
  IconClock,
  IconCloudUpload,
  IconLock,
  IconSparkles,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for occasional file sharing",
    features: [
      { text: "Up to 10GB per transfer", icon: IconCloudUpload },
      { text: "2-day link expiration", icon: IconClock },
      { text: "Password protection", icon: IconLock },
      { text: "Basic analytics", icon: IconSparkles },
    ],
    cta: "Get Started",
    popular: false,
    gradient: "from-neutral-500 to-neutral-700",
  },
  {
    name: "Unlimited",
    price: "$18",
    period: "/month",
    description: "For power users and businesses",
    features: [
      { text: "Unlimited transfer size", icon: IconInfinity },
      { text: "Up to 30-day expiration", icon: IconClock },
      { text: "Password protection", icon: IconLock },
      { text: "Priority support", icon: IconBolt },
      { text: "Advanced analytics", icon: IconSparkles },
      { text: "Custom branding", icon: IconSparkles },
    ],
    cta: "Upgrade Now",
    popular: true,
    gradient: "from-blue-500 to-purple-600",
  },
];

function GlowingCard({
  children,
  gradient,
  popular,
}: {
  children: React.ReactNode;
  gradient: string;
  popular: boolean;
}) {
  return (
    <div className="relative group">
      {/* Glow effect */}
      <div
        className={cn(
          "absolute -inset-0.5 rounded-2xl bg-gradient-to-r opacity-0 blur-lg transition-opacity duration-500",
          gradient,
          popular ? "opacity-50 group-hover:opacity-75" : "group-hover:opacity-30"
        )}
      />
      {/* Card */}
      <div
        className={cn(
          "relative bg-black/80 backdrop-blur-sm rounded-2xl border p-8",
          popular ? "border-purple-500/50" : "border-neutral-700"
        )}
      >
        {popular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full">
              Most Popular
            </span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleSelectPlan = (planName: string) => {
    if (!session) {
      router.push("/auth/signup");
      return;
    }

    if (planName === "Free") {
      router.push("/dashboard");
    } else {
      // TODO: Integrate Stripe checkout
      router.push("/dashboard?upgrade=true");
    }
  };

  return (
    <MatrixBackground>
      <Navbar />
      <main className="min-h-screen pt-24 pb-12 px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-neutral-400 text-lg">
            Choose the plan that works best for you. Upgrade or downgrade at any time.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <GlowingCard gradient={plan.gradient} popular={plan.popular}>
                {/* Plan Header */}
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    <span className="text-neutral-400">{plan.period}</span>
                  </div>
                  <p className="text-neutral-500 text-sm mt-2">{plan.description}</p>
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center",
                          plan.popular ? "bg-purple-500/20" : "bg-neutral-700/50"
                        )}
                      >
                        <IconCheck
                          size={12}
                          className={plan.popular ? "text-purple-400" : "text-neutral-400"}
                        />
                      </div>
                      <span className="text-neutral-300 text-sm">{feature.text}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => handleSelectPlan(plan.name)}
                  className={cn(
                    "w-full py-3 rounded-xl font-medium transition-all",
                    plan.popular
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90"
                      : "bg-neutral-800 text-white border border-neutral-700 hover:bg-neutral-700"
                  )}
                >
                  {plan.cta}
                </button>
              </GlowingCard>
            </motion.div>
          ))}
        </div>

        {/* FAQ or additional info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="max-w-2xl mx-auto mt-16 text-center"
        >
          <p className="text-neutral-500 text-sm">
            All plans include end-to-end encryption, secure file storage, and 24/7 uptime.
            <br />
            Questions? Contact us at{" "}
            <a href="mailto:support@transfer.frooty.ai" className="text-blue-400 hover:underline">
              support@transfer.frooty.ai
            </a>
          </p>
        </motion.div>
      </main>
    </MatrixBackground>
  );
}
