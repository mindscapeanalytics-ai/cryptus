import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sub = await prisma.subscription.findUnique({
      where: { id: id.startsWith('np_') ? id : `np_${id}` },
      select: { status: true, plan: true }
    });

    if (!sub) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ status: sub.status });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
