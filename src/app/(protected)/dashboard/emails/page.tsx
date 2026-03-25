import { createClient } from "@/lib/supabase/server";
import { getEmails, getGmailConnection, getEmailStats } from "@/lib/data/emails";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { EmailList } from "@/components/emails/email-list";
import Link from "next/link";

export default async function EmailsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const connection = await getGmailConnection(supabase, user.id);

  if (!connection) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Emails</h1>
          <p className="text-sm text-muted-foreground">
            Track application-related emails
          </p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Mail className="size-6 text-muted-foreground" />
            </div>
            <CardTitle>Connect Your Gmail</CardTitle>
            <CardDescription>
              Connect your Gmail account to automatically import and classify
              job application emails.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/api/gmail/connect">Connect Gmail</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const emails = await getEmails(supabase, { limit: 100 });
  const stats = await getEmailStats(supabase);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Emails</h1>
        <p className="text-sm text-muted-foreground">
          {stats.unread > 0
            ? `${stats.unread} unread email${stats.unread !== 1 ? "s" : ""}`
            : "All caught up"}
        </p>
      </div>

      <EmailList
        emails={emails}
        lastSyncedAt={connection.last_synced_at}
        stats={stats.byClassification}
      />
    </div>
  );
}
