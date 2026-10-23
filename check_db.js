const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const reservations = await prisma.reservation.findMany({
    include: {
      room: true,
      guests: { include: { guest: true } },
      payments: true,
      folios: { include: { items: true } },
    },
    orderBy: { createdAt: 'desc' }
  });
  console.log('RESERVATIONS IN DB:');
  for (const r of reservations) {
    console.log(JSON.stringify({
      id: r.id,
      conf: r.confirmationNo,
      bookingId: r.bookingId,
      status: r.status,
      room: r.room?.number,
      totalAmount: r.totalAmount,
      depositAmount: r.depositAmount,
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      guests: r.guests.map(g => ({ name: `${g.guest.firstName} ${g.guest.lastName}`, isPrimary: g.isPrimary })),
      payments: r.payments.map(p => ({ id: p.id, amount: p.amount, status: p.status, method: p.paymentMethod, type: p.paymentType, voided: p.voidedAt })),
      folioBalance: r.folios.map(f => ({ balance: f.balance, totalCharges: f.totalCharges, totalPayments: f.totalPayments, items: f.items.length }))
    }, null, 2));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
