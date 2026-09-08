import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CheckoutFlow } from '@/components/public/CheckoutFlow';

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams: Promise<{ staff?: string }>;
}) {
  const { shopId } = await params;
  const { staff } = await searchParams;
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, deletedAt: null, isActive: true },
    select: { id: true, name: true },
  });
  if (!shop) notFound();
  return <CheckoutFlow shopId={shop.id} shopName={shop.name} initialStaffId={staff} />;
}
