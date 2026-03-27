"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Kanban,
  FileText,
  Mail,
  Search,
  Settings,
  User,
  PenLine,
  Puzzle,
  BookOpen,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/draft", label: "Draft Application", icon: PenLine },
  { href: "/dashboard/answers", label: "Answer Library", icon: BookOpen },
  { href: "/dashboard/applications", label: "Applications", icon: Kanban },
  { href: "/dashboard/resumes", label: "Resumes", icon: FileText },
  { href: "/dashboard/emails", label: "Emails", icon: Mail },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/jobs", label: "Jobs", icon: Search },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/extension", label: "Extension", icon: Puzzle },
];

export function NavLinks({ collapsed }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {links.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href !== "/dashboard" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-primary/20 text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <link.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{link.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
