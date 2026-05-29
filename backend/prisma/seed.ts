import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@nexclass.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'changeme123';
  const fullName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`✅ Super Admin already exists: ${email}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: hashedPassword,
      fullName,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log(`✅ Super Admin seeded successfully`);
  console.log(`   Email:    ${user.email}`);
  console.log(`   Name:     ${user.fullName}`);
  console.log(`   Role:     ${user.role}`);
  console.log(`   ID:       ${user.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
