import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getGmailConnection } from "@/lib/data/emails";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Bot, LogOut } from "lucide-react";
import { SignOutButton } from "./sign-out-button";
import { GmailConnectionCard } from "@/components/settings/gmail-connection";
import { LinkedInConnectionCard } from "@/components/settings/linkedin-connection";
import type { LinkedInConnection } from "@/lib/types/database";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fullName = user?.user_metadata?.full_name || "User";
  const email = user?.email || "";
  const avatarUrl = user?.user_metadata?.avatar_url || null;
  const initials = fullName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  const [gmailConnection, linkedInResult] = await Promise.all([
    user ? getGmailConnection(supabase, user.id) : Promise.resolve(null),
    user
      ? supabase
          .from("linkedin_connections")
          .select("*")
          .eq("user_id", user.id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  const linkedInConnection = (linkedInResult.data as LinkedInConnection | null) ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-lg font-semibold">{fullName}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Connected Accounts
          </CardTitle>
          <CardDescription>
            Connect external services to enhance your experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
            <GmailConnectionCard connection={gmailConnection} />
          </Suspense>
          <Separator />
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading...</div>}>
            <LinkedInConnectionCard connection={linkedInConnection} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Settings
          </CardTitle>
          <CardDescription>
            Configure AI-powered features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Resume Tailoring</p>
              <p className="text-xs text-muted-foreground">
                AI-powered resume customization for each application
              </p>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Cover Letter Generation</p>
              <p className="text-xs text-muted-foreground">
                Generate personalized cover letters using job descriptions
              </p>
            </div>
            <Badge variant="secondary">Coming Soon</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <LogOut className="h-5 w-5" />
            Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
