import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [items, runs] = await Promise.all([
    prisma.intelligenceItem.findMany({
      where: { userId: session.user.id, status: { not: 'dismissed' } },
      orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      take: 30,
    }),
    prisma.intelligenceRun.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  return NextResponse.json({ items, runs });
}
