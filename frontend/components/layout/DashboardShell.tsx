"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Brain, Database, Settings, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardShellProps {
  children: ReactNode;
}

const navItems: Array<{
  icon: LucideIcon;
  href: string;
  label: string;
  disabled?: boolean;
}> = [
  {
    icon: BarChart3,
    href: "/",
    label: "Research",
  },
  {
    icon: Database,
    href: "/data",
    label: "Data",
  },
  {
    icon: Brain,
    href: "/agents",
    label: "Agents",
    disabled: true,
  },
  {
    icon: Settings,
    href: "/settings",
    label: "Settings",
    disabled: true,
  },
];

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200 overflow-hidden">
      {/* LEFT SIDEBAR - Squared icons navigation */}
      <div className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-6 gap-8">
        {/* Logo */}
        <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-zinc-950 font-bold text-xl">
          AQ
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={item.disabled ? "pointer-events-none" : ""}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={item.disabled}
                  className={`w-10 h-10 rounded-2xl hover:bg-zinc-800 ${
                    isActive ? "bg-zinc-800 text-emerald-400" : "text-zinc-400"
                  }`}
                  title={item.label}
                >
                  <Icon className="w-5 h-5" />
                </Button>
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
