"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  PenLine,
  BookOpen,
  FileText,
  Mail,
  Search,
  Settings,
  User,
  Puzzle,
  Brain,
  UploadCloud,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    label: "GENERAL",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/applications", label: "Applications", icon: Briefcase },
      { href: "/dashboard/review", label: "Weekly Review", icon: BarChart3 },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { href: "/dashboard/draft", label: "Draft Application", icon: PenLine },
      { href: "/dashboard/answers", label: "Answer Library", icon: BookOpen },
    ],
  },
  {
    label: "KNOWLEDGE",
    items: [
      { href: "/dashboard/knowledge", label: "Overview", icon: Brain },
      { href: "/dashboard/knowledge/upload", label: "Upload", icon: UploadCloud },
    ],
  },
  {
    label: "MANAGE",
    items: [
      { href: "/dashboard/resumes", label: "Resumes", icon: FileText },
      { href: "/dashboard/emails", label: "Emails", icon: Mail },
      { href: "/dashboard/profile", label: "Profile", icon: User },
      { href: "/dashboard/jobs", label: "Jobs", icon: Search },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
      { href: "/dashboard/extension", label: "Extension", icon: Puzzle },
    ],
  },
];

export function NavLinks({ collapsed }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col px-3">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-4">
          {!collapsed && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              {section.label}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {section.items.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/dashboard" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary font-medium"
                      : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <link.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{link.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
