const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@nexclass.com';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Changeme123';
  const fullName = process.env.SUPER_ADMIN_NAME || 'Super Admin';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Super admin already exists: ' + email);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, passwordHash: hash, fullName, role: 'SUPER_ADMIN', isActive: true },
  });
  console.log('Super admin created: ' + email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
