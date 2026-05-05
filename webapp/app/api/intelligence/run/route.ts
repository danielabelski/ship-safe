import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runSecurityIntelligence } from '@/lib/security-intelligence';

export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const run = await runSecurityIntelligence(session.user.id);
  return NextResponse.json({ run }, { status: run.status === 'error' ? 500 : 201 });
}
