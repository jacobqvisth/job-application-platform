"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Briefcase,
  Search,
  PenLine,
  BookOpen,
  Brain,
  FileText,
  MoreHorizontal,
  Settings,
  User,
  LogOut,
  Mail,
  BarChart3,
  UploadCloud,
  MessageCircle,
  Puzzle,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Primary nav items shown in the rail
const PRIMARY_NAV = [
  { href: "/dashboard/chat", label: "Chat", icon: MessageSquare },
  { href: "/dashboard/applications", label: "Applications", icon: Briefcase },
  { href: "/dashboard/job-leads", label: "Job Leads", icon: Target },
  { href: "/dashboard/jobs", label: "Jobs", icon: Search },
  { href: "/dashboard/draft", label: "Draft Application", icon: PenLine },
  { href: "/dashboard/answers", label: "Answer Library", icon: BookOpen },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: Brain },
  { href: "/dashboard/resumes", label: "Resumes", icon: FileText },
];

// Secondary nav items in "More" dropdown
const MORE_NAV = [
  { href: "/dashboard/emails", label: "Emails", icon: Mail },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/review", label: "Weekly Review", icon: BarChart3 },
  { href: "/dashboard/knowledge/upload", label: "Upload Documents", icon: UploadCloud },
  { href: "/dashboard/knowledge/interview", label: "Knowledge Interview", icon: MessageCircle },
  { href: "/dashboard/extension", label: "Browser Extension", icon: Puzzle },
];

// Mobile bottom tab bar (top 5)
const MOBILE_NAV = [
  { href: "/dashboard/chat", label: "Chat", icon: MessageSquare },
  { href: "/dashboard/applications", label: "Apps", icon: Briefcase },
  { href: "/dashboard/jobs", label: "Jobs", icon: Search },
  { href: "/dashboard/draft", label: "Draft", icon: PenLine },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: Brain },
];

interface NavRailProps {
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export function NavRail({ email, fullName, avatarUrl }: NavRailProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : email[0]?.toUpperCase() ?? "U";

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const moreIsActive = MORE_NAV.some((item) => isActive(item.href));

  return (
    <>
      {/* Desktop nav rail */}
      <aside className="hidden md:flex flex-col w-16 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0">
        {/* Logo */}
        <div className="flex h-14 items-center justify-center border-b border-sidebar-border shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.44_0.19_265)] to-[oklch(0.62_0.16_240)] shadow-sm">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
        </div>

        {/* Primary nav items */}
        <nav className="flex flex-col items-center gap-1 py-3 flex-1 overflow-y-auto">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <div key={item.href} className="relative group w-full flex justify-center">
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg transition-colors relative",
                    active
                      ? "bg-sidebar-accent text-[oklch(0.44_0.19_265)]"
                      : "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                  title={item.label}
                >
                  {/* Active indicator */}
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-1 h-5 rounded-r-full bg-[oklch(0.44_0.19_265)]" />
                  )}
                  <item.icon className={cn("h-5 w-5", active && "stroke-[2.25]")} />
                </Link>
                {/* Hover tooltip */}
                <span className="absolute left-full ml-2 whitespace-nowrap bg-popover border border-border text-popover-foreground rounded-md px-2 py-1 text-xs opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-sm">
                  {item.label}
                </span>
              </div>
            );
          })}

          {/* More dropdown */}
          <div className="relative group w-full flex justify-center mt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  title="More"
                  className={cn(
                    "w-10 h-10 rounded-lg",
                    moreIsActive
                      ? "bg-sidebar-accent text-[oklch(0.44_0.19_265)]"
                      : "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  )}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="center" className="w-52">
                {MORE_NAV.map((item) => (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2",
                        isActive(item.href) && "text-[oklch(0.44_0.19_265)] font-medium"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="absolute left-full ml-2 whitespace-nowrap bg-popover border border-border text-popover-foreground rounded-md px-2 py-1 text-xs opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-sm">
              More
            </span>
          </div>
        </nav>

        {/* Bottom: Settings + Avatar */}
        <div className="flex flex-col items-center gap-1 py-3 border-t border-sidebar-border shrink-0">
          <div className="relative group w-full flex justify-center">
            <Link
              href="/dashboard/settings"
              title="Settings"
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
                isActive("/dashboard/settings")
                  ? "bg-sidebar-accent text-[oklch(0.44_0.19_265)]"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <Settings className="h-5 w-5" />
            </Link>
            <span className="absolute left-full ml-2 whitespace-nowrap bg-popover border border-border text-popover-foreground rounded-md px-2 py-1 text-xs opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-sm">
              Settings
            </span>
          </div>

          {/* User avatar + sign out */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-lg p-0 text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                title={fullName ?? email}
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-52">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{fullName ?? "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-background border-t border-border h-16 px-2">
        {MOBILE_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0",
                active
                  ? "text-[oklch(0.44_0.19_265)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.25]")} />
              <span className="text-[10px] font-medium truncate">{item.label}</span>
            </Link>
          );
        })}
        {/* More on mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors text-muted-foreground hover:text-foreground">
              <MoreHorizontal className="h-5 w-5 shrink-0" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-52 mb-2">
            {MORE_NAV.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href} className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </>
  );
}
