import { NextResponse } from "next/server";
import { getMorningBriefData } from "@/lib/chat/morning-brief";

export async function GET() {
  const data = await getMorningBriefData();
  if (!data) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(data);
}
