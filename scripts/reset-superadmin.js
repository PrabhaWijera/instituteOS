// Reset super admin password hash to env value.
// Usage (host): docker compose exec backend node /app/scripts/reset-superadmin.js
const prismaMod = require('/app/dist/config/prisma');
const prisma = prismaMod.default || prismaMod;
const { hashPassword } = require('/app/dist/utils/hash');

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@nexclass.com';
  const pw = process.env.SUPER_ADMIN_PASSWORD || 'Changeme123';

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`Super admin user not found for email: ${email}`);
  }

  const passwordHash = await hashPassword(pw);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, isActive: true, isDeleted: false, role: 'SUPER_ADMIN' },
  });

  console.log(`Super admin password reset for ${email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    try {
      await prisma.$disconnect();
    } finally {
      process.exit(1);
    }
  });

