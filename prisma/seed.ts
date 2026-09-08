import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Demo data for local dev/testing of the booking flow (Phase 3.4).
// Idempotent: safe to re-run.
async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo.shop' },
    update: {},
    create: {
      email: 'owner@demo.shop',
      passwordHash,
      firstName: 'Demo',
      lastName: 'Owner',
      role: 'admin',
      emailVerified: true,
    },
  });

  const shop = await prisma.shop.upsert({
    where: { slug: 'demo-barbershop' },
    update: {},
    create: {
      ownerId: owner.id,
      name: 'Demo Barbershop',
      slug: 'demo-barbershop',
      description: 'Seeded demo shop for local development',
      addressLine1: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      phone: '+1-555-0100',
      timezone: 'America/Chicago',
    },
  });

  const barberUser = await prisma.user.upsert({
    where: { email: 'barber@demo.shop' },
    update: {},
    create: {
      email: 'barber@demo.shop',
      passwordHash,
      firstName: 'Demo',
      lastName: 'Barber',
      role: 'staff',
      emailVerified: true,
    },
  });

  const staff = await prisma.staff.upsert({
    where: { userId_shopId: { userId: barberUser.id, shopId: shop.id } },
    update: { isActive: true },
    create: {
      userId: barberUser.id,
      shopId: shop.id,
      bio: 'Seeded demo barber',
      specialties: ['Classic cut'],
    },
  });

  let service = await prisma.service.findFirst({ where: { shopId: shop.id, name: 'Classic Cut' } });
  if (!service) {
    service = await prisma.service.create({
      data: {
        shopId: shop.id,
        name: 'Classic Cut',
        description: 'Seeded demo service',
        durationMinutes: 30,
        price: 25.0,
        bufferMinutes: 5,
        category: 'Haircut',
      },
    });
  }

  await prisma.staffService.upsert({
    where: { staffId_serviceId: { staffId: staff.id, serviceId: service.id } },
    update: {},
    create: { staffId: staff.id, serviceId: service.id },
  });

  // Mon–Fri 09:00–17:00 UTC
  for (let dow = 1; dow <= 5; dow++) {
    await prisma.availability.upsert({
      where: {
        staffId_dayOfWeek_startTime: {
          staffId: staff.id,
          dayOfWeek: dow,
          startTime: new Date('1970-01-01T09:00:00Z'),
        },
      },
      update: { endTime: new Date('1970-01-01T17:00:00Z'), isActive: true },
      create: {
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
