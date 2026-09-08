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
    where: { email: { in: ['owner@demo.shop', 'barber@demo.shop', 'marco@demo.shop', 'jay@demo.shop'] } },
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
      const bookingIds = (
        await prisma.booking.findMany({ where: { shopId: { in: shopIds } }, select: { id: true } })
      ).map((b) => b.id);
      if (bookingIds.length > 0) {
        await prisma.notification.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await prisma.review.deleteMany({ where: { bookingId: { in: bookingIds } } });
      }
      await prisma.booking.deleteMany({ where: { shopId: { in: shopIds } } });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: demoIds } } });
      const staffIds = (
        await prisma.staff.findMany({ where: { shopId: { in: shopIds } }, select: { id: true } })
      ).map((s) => s.id);
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

  const barbers = [
    {
      email: 'barber@demo.shop',
      firstName: 'Alex',
      lastName: 'Reyes',
      bio: 'Clean fades, classic scissor work, and honest advice on what suits the way you wear it.',
      specialties: ['Skin Fade', 'Classic cut'],
    },
    {
      email: 'marco@demo.shop',
      firstName: 'Marco',
      lastName: 'Santos',
      bio: 'Beard sculpting and hot-towel finishes for a sharp, put-together look every visit.',
      specialties: ['Beard Sculpt', 'Hot Towel'],
    },
    {
      email: 'jay@demo.shop',
      firstName: 'Jay',
      lastName: 'Cruz',
      bio: 'Patient with first-timers, precise with regulars — every chair leaves sharper than it arrived.',
      specialties: ['Classic cut', 'Kids Cut'],
    },
  ];

  const services = [
    {
      name: 'Classic Cut',
      description: 'Consultation, cut, hot-lather neckline, and style.',
      durationMinutes: 30,
      price: 350.0,
      bufferMinutes: 5,
      category: 'Haircut',
    },
    {
      name: 'Skin Fade',
      description: 'Seamless blend from skin to length, finished with crisp line-up.',
      durationMinutes: 45,
      price: 450.0,
      bufferMinutes: 5,
      category: 'Haircut',
    },
    {
      name: 'Hot Towel Shave',
      description: 'Traditional straight-razor shave with hot towels and cooling finish.',
      durationMinutes: 30,
      price: 300.0,
      bufferMinutes: 5,
      category: 'Shave',
    },
  ];

  const staffIds: string[] = [];
  for (const b of barbers) {
    const user = await prisma.user.create({
      data: {
        email: b.email,
        passwordHash,
        firstName: b.firstName,
        lastName: b.lastName,
        role: 'staff',
        emailVerified: true,
      },
    });
    const staff = await prisma.staff.create({
      data: {
        userId: user.id,
        shopId: shop.id,
        title: 'Hairstylist & Barber',
        bio: b.bio,
        specialties: b.specialties,
      },
    });
    staffIds.push(staff.id);

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
  }

  const serviceIds: string[] = [];
  for (const s of services) {
    const service = await prisma.service.create({ data: { shopId: shop.id, ...s } });
    serviceIds.push(service.id);
  }

  // Every barber offers every service; Marco takes a custom price on Classic Cut.
  const marco = await prisma.staff.findFirst({ where: { id: staffIds[1] } });
  const classic = await prisma.service.findFirst({ where: { id: serviceIds[0] } });
  for (const staffId of staffIds) {
    for (const serviceId of serviceIds) {
      await prisma.staffService.create({
        data: {
          staffId,
          serviceId,
          ...(marco && classic && staffId === marco.id && serviceId === classic.id
            ? { customPrice: 300.0 }
            : {}),
        },
      });
    }
  }

  console.log(JSON.stringify({ shopId: shop.id, staffIds, serviceIds }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
