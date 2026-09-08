import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Demo data for local dev/testing (single-brand: BarberHouse).
// Clears the previous demo graph first, then recreates it. Safe to re-run
// on a dev database (fails if real customer bookings reference demo rows).
async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  // Clear previous demo graph (FK-safe order)
  const demoUsers = await prisma.user.findMany({
    where: { email: { in: ['owner@demo.shop', 'barber@demo.shop'] } },
    select: { id: true },
  });
  const demoIds = demoUsers.map((u) => u.id);
  if (demoIds.length > 0) {
    const demoShops = await prisma.shop.findMany({
      where: { ownerId: { in: demoIds } },
      select: { id: true },
    });
    const shopIds = demoShops.map((s) => s.id);
    if (shopIds.length > 0) {
      await prisma.notification.deleteMany({ where: { bookingId: { in: (await prisma.booking.findMany({ where: { shopId: { in: shopIds } }, select: { id: true } })).map((b) => b.id) } } });
      await prisma.review.deleteMany({ where: { shopId: { in: shopIds } } });
      await prisma.booking.deleteMany({ where: { shopId: { in: shopIds } } });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: demoIds } } });
      const staffIds = (await prisma.staff.findMany({ where: { shopId: { in: shopIds } }, select: { id: true } })).map((s) => s.id);
      if (staffIds.length > 0) {
        await prisma.staffService.deleteMany({ where: { staffId: { in: staffIds } } });
        await prisma.availability.deleteMany({ where: { staffId: { in: staffIds } } });
        await prisma.timeOff.deleteMany({ where: { staffId: { in: staffIds } } });
        await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
      }
      await prisma.service.deleteMany({ where: { shopId: { in: shopIds } } });
      await prisma.shop.deleteMany({ where: { id: { in: shopIds } } });
    }
    await prisma.user.deleteMany({ where: { id: { in: demoIds } } });
  }

  const owner = await prisma.user.create({
    data: {
      email: 'owner@demo.shop',
      passwordHash,
      firstName: 'House',
      lastName: 'Owner',
      role: 'admin',
      emailVerified: true,
    },
  });

  const shop = await prisma.shop.create({
    data: {
      ownerId: owner.id,
      name: 'BarberHouse',
      slug: 'barberhouse',
      description: 'The neighborhood booking house for classic cuts, sharp fades, and unhurried straight-razor shaves.',
      addressLine1: '123 Grooming Blvd',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      phone: '+1-555-0100',
      timezone: 'America/Chicago',
    },
  });

  const barberUser = await prisma.user.create({
    data: {
      email: 'barber@demo.shop',
      passwordHash,
      firstName: 'Alex',
      lastName: 'Reyes',
      role: 'staff',
      emailVerified: true,
    },
  });

  const staff = await prisma.staff.create({
    data: {
      userId: barberUser.id,
      shopId: shop.id,
      bio: 'House barber, precision fades',
      specialties: ['Classic cut', 'Skin fade'],
    },
  });

  const service = await prisma.service.create({
    data: {
      shopId: shop.id,
      name: 'Classic Cut',
      description: 'Consultation, cut, hot-lather neckline, and style.',
      durationMinutes: 30,
      price: 350.0,
      bufferMinutes: 5,
      category: 'Haircut',
    },
  });

  await prisma.staffService.create({ data: { staffId: staff.id, serviceId: service.id } });

  // Mon–Fri 09:00–17:00 UTC
  for (let dow = 1; dow <= 5; dow++) {
    await prisma.availability.create({
      data: {
        staffId: staff.id,
        dayOfWeek: dow,
        startTime: new Date('1970-01-01T09:00:00Z'),
        endTime: new Date('1970-01-01T17:00:00Z'),
      },
    });
  }

  console.log(JSON.stringify({ shopId: shop.id, staffId: staff.id, serviceId: service.id }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
