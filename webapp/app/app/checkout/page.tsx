import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe, PLANS } from '@/lib/stripe';
import { redirect } from 'next/navigation';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect('/login');
  }

  const { plan } = await searchParams;

  if (plan !== 'pro' && plan !== 'team') {
    redirect('/pricing');
  }

  // Already on an equal or higher plan — send straight to dashboard
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });
  if (user?.plan === plan || user?.plan === 'team' || user?.plan === 'enterprise') {
    redirect('/app');
  }

  const planConfig = PLANS[plan];
  const origin = process.env.NEXTAUTH_URL ?? 'https://shipsafe.dev';

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: session.user.email,
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    metadata: { userId: session.user.id, plan },
    success_url: `${origin}/app?upgraded=${plan}`,
    cancel_url: `${origin}/pricing`,
  });

  await prisma.payment.create({
    data: {
      userId: session.user.id,
      stripeSessionId: checkoutSession.id,
      plan,
      amount: planConfig.price,
      status: 'pending',
    },
  });

  redirect(checkoutSession.url!);
}
