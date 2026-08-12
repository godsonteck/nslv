// ============================================
// NS LUXURY VILLA — Reporting & Analytics Service
// Real Database-Derived Financial & Operational Metrics
// ============================================

import { prisma } from '../config';

export class ReportService {
  /** Get Dashboard Overview Metrics */
  static async getDashboardMetrics() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // Room stats
    const totalRooms = await prisma.room.count({ where: { isActive: true } });
    const occupiedRooms = await prisma.room.count({ where: { status: 'OCCUPIED' } });
    const reservedRooms = await prisma.room.count({ where: { status: 'RESERVED' } });
    const availableRooms = await prisma.room.count({ where: { status: 'AVAILABLE' } });
    const dirtyRooms = await prisma.room.count({ where: { status: 'DIRTY' } });

    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Today's arrivals and departures
    const checkInsToday = await prisma.checkIn.count({
      where: {
        actualCheckIn: { gte: startOfDay, lte: endOfDay },
      },
    });

    const checkOutsToday = await prisma.checkOut.count({
      where: {
        actualCheckOut: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Revenue metrics (calculated from Payment transactions)
    const paymentsToday = await prisma.payment.aggregate({
      where: {
        processedAt: { gte: startOfDay, lte: endOfDay },
        status: 'COMPLETED',
        type: 'PAYMENT',
      },
      _sum: { amount: true },
    });

    const restaurantToday = await prisma.restaurantOrder.aggregate({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ['COMPLETED', 'SERVED'] },
      },
      _sum: { totalAmount: true },
    });

    const barToday = await prisma.barOrder.aggregate({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ['COMPLETED', 'SERVED'] },
      },
      _sum: { totalAmount: true },
    });

    const poolToday = await prisma.poolTransaction.aggregate({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      _sum: { totalAmount: true },
    });

    // Outstanding balances in open folios
    const openFolios = await prisma.folio.aggregate({
      where: { status: 'OPEN' },
      _sum: { balance: true },
    });

    return {
      totalRooms,
      occupiedRooms,
      reservedRooms,
      availableRooms,
      dirtyRooms,
      occupancyRate,
      checkInsToday,
      checkOutsToday,
      revenueToday: Number(paymentsToday._sum.amount || 0),
      restaurantRevenueToday: Number(restaurantToday._sum.totalAmount || 0),
      barRevenueToday: Number(barToday._sum.totalAmount || 0),
      poolRevenueToday: Number(poolToday._sum.totalAmount || 0),
      outstandingBalanceTotal: Number(openFolios._sum.balance || 0),
    };
  }

  /** Get Full Financial & Operational Report */
  static async getComprehensiveReport(startDate?: Date, endDate?: Date) {
    const whereDate = startDate && endDate ? { gte: startDate, lte: endDate } : undefined;

    const totalPayments = await prisma.payment.aggregate({
      where: {
        processedAt: whereDate,
        status: 'COMPLETED',
        type: 'PAYMENT',
      },
      _sum: { amount: true },
    });

    const restaurantSales = await prisma.restaurantOrder.aggregate({
      where: { createdAt: whereDate, status: { in: ['COMPLETED', 'SERVED'] } },
      _sum: { totalAmount: true },
    });

    const barSales = await prisma.barOrder.aggregate({
      where: { createdAt: whereDate, status: { in: ['COMPLETED', 'SERVED'] } },
      _sum: { totalAmount: true },
    });

    const poolSales = await prisma.poolTransaction.aggregate({
      where: { createdAt: whereDate },
      _sum: { totalAmount: true },
    });

    const reservationsCount = await prisma.reservation.count({ where: { createdAt: whereDate } });
    const checkInsCount = await prisma.checkIn.count({ where: { actualCheckIn: whereDate } });
    const checkOutsCount = await prisma.checkOut.count({ where: { actualCheckOut: whereDate } });

    return {
      period: { startDate, endDate },
      totalCollectedRevenue: Number(totalPayments._sum.amount || 0),
      departmentRevenue: {
        restaurant: Number(restaurantSales._sum.totalAmount || 0),
        bar: Number(barSales._sum.totalAmount || 0),
        pool: Number(poolSales._sum.totalAmount || 0),
      },
      operations: {
        reservationsCount,
        checkInsCount,
        checkOutsCount,
      },
    };
  }
}
