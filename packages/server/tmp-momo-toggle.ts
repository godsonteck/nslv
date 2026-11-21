import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/** TEMP: toggle the guest-facing MoMo number while reviewing the booking UI. */
async function main() {
  const prisma = new PrismaClient();
  const key = 'booking.momo_number';
  if (process.argv[2] === 'set') {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify('024 000 0000') },
      create: { key, value: JSON.stringify('024 000 0000'), category: 'booking', description: 'Temporary QA value' },
    });
    console.log('set');
  } else {
    await prisma.systemSetting.deleteMany({ where: { key } });
    console.log('cleared');
  }
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
