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
    const maintenanceRooms = await prisma.room.count({ where: { status: { in: ['MAINTENANCE', 'OUT_OF_SERVICE'] } } });

    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // In-house guests and people headcount
    const activeStays = await prisma.checkIn.findMany({
      where: { reservation: { status: 'CHECKED_IN' } },
      include: { reservation: true },
    });
    const inHouseAdults = activeStays.reduce((sum, s) => sum + (s.reservation?.adults || 1), 0);
    const inHouseChildren = activeStays.reduce((sum, s) => sum + (s.reservation?.children || 0), 0);
    const inHousePeopleCount = inHouseAdults + inHouseChildren;

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
      maintenanceRooms,
      occupancyRate,
      inHouseAdults,
      inHouseChildren,
      inHousePeopleCount,
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

    // 1. Room Capacity & Current Occupancy
    const totalRooms = await prisma.room.count({ where: { isActive: true } });
    const occupiedRooms = await prisma.room.count({ where: { status: 'OCCUPIED' } });
    const reservedRooms = await prisma.room.count({ where: { status: 'RESERVED' } });
    const availableRooms = await prisma.room.count({ where: { status: 'AVAILABLE' } });
    const dirtyRooms = await prisma.room.count({ where: { status: 'DIRTY' } });
    const maintenanceRooms = await prisma.room.count({ where: { status: { in: ['MAINTENANCE', 'OUT_OF_SERVICE'] } } });
    const currentOccupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // 2. Headcount & People Breakdown
    // In-house current people
    const activeStays = await prisma.checkIn.findMany({
      where: { reservation: { status: 'CHECKED_IN' } },
      include: { reservation: true },
    });
    const inHouseAdults = activeStays.reduce((sum, s) => sum + (s.reservation?.adults || 1), 0);
    const inHouseChildren = activeStays.reduce((sum, s) => sum + (s.reservation?.children || 0), 0);
    const inHousePeopleTotal = inHouseAdults + inHouseChildren;

    // Period reservations & people accommodated
    const reservationsInPeriod = await prisma.reservation.findMany({
      where: {
        OR: [
          { createdAt: whereDate },
          { checkInDate: whereDate },
          { checkOutDate: whereDate },
        ],
      },
      select: {
        id: true,
        status: true,
        adults: true,
        children: true,
        checkInDate: true,
        checkOutDate: true,
        totalAmount: true,
        baseRate: true,
      },
    });

    const totalReservations = reservationsInPeriod.length;
    const confirmedCount = reservationsInPeriod.filter((r) => r.status === 'CONFIRMED' || r.status === 'CHECKED_IN' || r.status === 'CHECKED_OUT').length;
    const cancelledCount = reservationsInPeriod.filter((r) => r.status === 'CANCELLED').length;
    const noShowCount = reservationsInPeriod.filter((r) => r.status === 'NO_SHOW').length;

    // Total people accommodated across non-cancelled reservations in period
    const validReservations = reservationsInPeriod.filter((r) => r.status !== 'CANCELLED');
    const totalAdultsAccommodated = validReservations.reduce((sum, r) => sum + (r.adults || 1), 0);
    const totalChildrenAccommodated = validReservations.reduce((sum, r) => sum + (r.children || 0), 0);
    const totalPeopleAccommodated = totalAdultsAccommodated + totalChildrenAccommodated;

    // Total room nights in period
    let totalRoomNights = 0;
    for (const r of validReservations) {
      const start = new Date(r.checkInDate).getTime();
      const end = new Date(r.checkOutDate).getTime();
      const nights = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
      totalRoomNights += nights;
    }

    // Total registered guests in database
    const totalRegisteredGuests = await prisma.guest.count();
    const newGuestsInPeriod = await prisma.guest.count({ where: { createdAt: whereDate } });

    // 3. Stays & Operations
    const checkInsCount = await prisma.checkIn.count({ where: { actualCheckIn: whereDate } });
    const checkOutsCount = await prisma.checkOut.count({ where: { actualCheckOut: whereDate } });

    // Late checkouts query & fees
    const lateFeeItems = await prisma.folioItem.findMany({
      where: {
        postedAt: whereDate,
        voidedAt: null,
        OR: [
          { referenceType: 'CHECKOUT' },
          { description: { contains: 'late checkout', mode: 'insensitive' } },
          { description: { contains: 'late check-out', mode: 'insensitive' } },
        ],
      },
      select: { amount: true, quantity: true },
    });
    const lateCheckOutsCount = lateFeeItems.length;
    const totalLateCheckoutFees = lateFeeItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    // 4. Financial Metrics & Revenue Breakdown
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

    const [
      cashPayments,
      refunds,
      cashRefunds,
      cashExpenses,
      accommodationRevenue,
      openReceivables,
      requiredDeposits,
      collectedDeposits,
      approvedExpenses,
    ] = await Promise.all([
      prisma.payment.aggregate({ where: { processedAt: whereDate, status: 'COMPLETED', type: 'PAYMENT', method: 'CASH', voidedAt: null }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { processedAt: whereDate, status: 'COMPLETED', type: 'REFUND', voidedAt: null }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { processedAt: whereDate, status: 'COMPLETED', type: 'REFUND', method: 'CASH', voidedAt: null }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { incurredOn: whereDate, status: 'APPROVED', paymentMethod: 'CASH' }, _sum: { amount: true } }),
      prisma.folioItem.aggregate({ where: { postedAt: whereDate, voidedAt: null, type: 'ACCOMMODATION' }, _sum: { amount: true } }),
      prisma.folio.aggregate({ where: { status: 'OPEN' }, _sum: { balance: true } }),
      prisma.reservation.aggregate({ where: { createdAt: whereDate }, _sum: { depositAmount: true } }),
      prisma.payment.aggregate({ where: { processedAt: whereDate, status: 'COMPLETED', type: 'DEPOSIT', voidedAt: null }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { incurredOn: whereDate, status: 'APPROVED' }, _sum: { amount: true } }),
    ]);

    // Expenses breakdown by category
    const expenseRecords = await prisma.expense.findMany({
      where: { incurredOn: whereDate, status: 'APPROVED' },
      select: { category: true, amount: true },
    });
    const expensesByCategory: Record<string, number> = {};
    for (const exp of expenseRecords) {
      const cat = exp.category || 'GENERAL';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(exp.amount || 0);
    }

    const restaurant = Number(restaurantSales._sum.totalAmount || 0);
    const bar = Number(barSales._sum.totalAmount || 0);
    const pool = Number(poolSales._sum.totalAmount || 0);
    const accommodation = Number(accommodationRevenue._sum.amount || 0);
    const totalExpenses = Number(approvedExpenses._sum.amount || 0);
    const totalRevenueAccrued = accommodation + restaurant + bar + pool;

    // ADR (Average Daily Rate) and RevPAR (Revenue Per Available Room)
    const daysInPeriod = startDate && endDate ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1) : 30;
    const totalAvailableRoomNights = Math.max(1, totalRooms * daysInPeriod);
    const averageDailyRate = totalRoomNights > 0 ? Number((accommodation / totalRoomNights).toFixed(2)) : 0;
    const revPAR = totalAvailableRoomNights > 0 ? Number((accommodation / totalAvailableRoomNights).toFixed(2)) : 0;

    // 5. Daily Timeline Breakdown (for Daily, Weekly, and Monthly views)
    const dailyBreakdown: Array<{
      date: string;
      dayName: string;
      revenue: number;
      accommodation: number;
      restaurant: number;
      bar: number;
      pool: number;
      lateFees: number;
      expenses: number;
      net: number;
      checkIns: number;
      checkOuts: number;
      lateCheckOuts: number;
      peopleAccommodated: number;
    }> = [];

    if (startDate && endDate && daysInPeriod <= 62) {
      const curr = new Date(startDate);
      const endLimit = new Date(endDate);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      // Fetch all relevant day-scoped records in one pass to stay super fast
      const [allPayments, allExpenses, allRest, allBar, allPool, allCheckIns, allCheckOuts, allLateFees] = await Promise.all([
        prisma.payment.findMany({
          where: { processedAt: whereDate, status: 'COMPLETED', type: 'PAYMENT' },
          select: { processedAt: true, amount: true },
        }),
        prisma.expense.findMany({
          where: { incurredOn: whereDate, status: 'APPROVED' },
          select: { incurredOn: true, amount: true },
        }),
        prisma.restaurantOrder.findMany({
          where: { createdAt: whereDate, status: { in: ['COMPLETED', 'SERVED'] } },
          select: { createdAt: true, totalAmount: true },
        }),
        prisma.barOrder.findMany({
          where: { createdAt: whereDate, status: { in: ['COMPLETED', 'SERVED'] } },
          select: { createdAt: true, totalAmount: true },
        }),
        prisma.poolTransaction.findMany({
          where: { createdAt: whereDate },
          select: { createdAt: true, totalAmount: true },
        }),
        prisma.checkIn.findMany({
          where: { actualCheckIn: whereDate },
          select: { actualCheckIn: true, reservation: { select: { adults: true, children: true } } },
        }),
        prisma.checkOut.findMany({
          where: { actualCheckOut: whereDate },
          select: { actualCheckOut: true },
        }),
        prisma.folioItem.findMany({
          where: {
            postedAt: whereDate,
            voidedAt: null,
            OR: [
              { referenceType: 'CHECKOUT' },
              { description: { contains: 'late checkout', mode: 'insensitive' } },
              { description: { contains: 'late check-out', mode: 'insensitive' } },
            ],
          },
          select: { postedAt: true, amount: true },
        }),
      ]);

      while (curr <= endLimit) {
        const dStr = curr.toISOString().slice(0, 10);
        const dayOfWeek = dayNames[curr.getUTCDay()];

        const dayPay = allPayments.filter((p) => p.processedAt && p.processedAt.toISOString().slice(0, 10) === dStr).reduce((s, p) => s + Number(p.amount || 0), 0);
        const dayExp = allExpenses.filter((e) => e.incurredOn && e.incurredOn.toISOString().slice(0, 10) === dStr).reduce((s, e) => s + Number(e.amount || 0), 0);
        const dayRest = allRest.filter((r) => r.createdAt && r.createdAt.toISOString().slice(0, 10) === dStr).reduce((s, r) => s + Number(r.totalAmount || 0), 0);
        const dayBar = allBar.filter((b) => b.createdAt && b.createdAt.toISOString().slice(0, 10) === dStr).reduce((s, b) => s + Number(b.totalAmount || 0), 0);
        const dayPool = allPool.filter((pl) => pl.createdAt && pl.createdAt.toISOString().slice(0, 10) === dStr).reduce((s, pl) => s + Number(pl.totalAmount || 0), 0);
        const dayLate = allLateFees.filter((l) => l.postedAt && l.postedAt.toISOString().slice(0, 10) === dStr).reduce((s, l) => s + Number(l.amount || 0), 0);
        const dayIns = allCheckIns.filter((ci) => ci.actualCheckIn && ci.actualCheckIn.toISOString().slice(0, 10) === dStr);
        const dayOuts = allCheckOuts.filter((co) => co.actualCheckOut && co.actualCheckOut.toISOString().slice(0, 10) === dStr);
        const dayLateOuts = allLateFees.filter((l) => l.postedAt && l.postedAt.toISOString().slice(0, 10) === dStr).length;
        const dayPeople = dayIns.reduce((sum, ci) => sum + ((ci.reservation?.adults || 1) + (ci.reservation?.children || 0)), 0);

        dailyBreakdown.push({
          date: dStr,
          dayName: dayOfWeek,
          revenue: dayPay,
          accommodation: Math.max(0, dayPay - dayRest - dayBar - dayPool),
          restaurant: dayRest,
          bar: dayBar,
          pool: dayPool,
          lateFees: dayLate,
          expenses: dayExp,
          net: dayPay - dayExp,
          checkIns: dayIns.length,
          checkOuts: dayOuts.length,
          lateCheckOuts: dayLateOuts,
          peopleAccommodated: dayPeople,
        });

        curr.setUTCDate(curr.getUTCDate() + 1);
      }
    }

    return {
      period: { startDate, endDate, daysInPeriod },
      occupancy: {
        totalRooms,
        occupiedRooms,
        reservedRooms,
        availableRooms,
        dirtyRooms,
        maintenanceRooms,
        occupancyRate: currentOccupancyRate,
        totalRoomNights,
        totalAvailableRoomNights,
      },
      people: {
        totalPeopleAccommodated,
        totalAdults: totalAdultsAccommodated,
        totalChildren: totalChildrenAccommodated,
        inHousePeopleTotal,
        inHouseAdults,
        inHouseChildren,
        totalRegisteredGuests,
        newGuestsInPeriod,
      },
      operations: {
        reservationsCount: totalReservations,
        confirmedCount,
        cancelledCount,
        noShowCount,
        checkInsCount,
        checkOutsCount,
        lateCheckOutsCount,
        totalLateCheckoutFees,
      },
      financials: {
        totalCollectedRevenue: Number(totalPayments._sum.amount || 0),
        accruedRevenue: totalRevenueAccrued,
        totalApprovedExpenses: totalExpenses,
        netOperatingIncome: totalRevenueAccrued - totalExpenses,
        averageDailyRate,
        revPAR,
        cash: {
          payments: Number(cashPayments._sum.amount || 0),
          refunds: Number(cashRefunds._sum.amount || 0),
          approvedExpenses: Number(cashExpenses._sum.amount || 0),
          netMovement: Number(cashPayments._sum.amount || 0) - Number(cashRefunds._sum.amount || 0) - Number(cashExpenses._sum.amount || 0),
        },
        refunds: Number(refunds._sum.amount || 0),
        receivables: Number(openReceivables._sum.balance || 0),
        deposits: {
          required: Number(requiredDeposits._sum.depositAmount || 0),
          collected: Number(collectedDeposits._sum.amount || 0),
        },
        departmentRevenue: {
          accommodation,
          restaurant,
          bar,
          pool,
          lateCheckout: totalLateCheckoutFees,
        },
        expensesByCategory,
      },
      dailyBreakdown,
      // Backward compatibility fields
      totalCollectedRevenue: Number(totalPayments._sum.amount || 0),
      accruedRevenue: totalRevenueAccrued,
      cash: {
        payments: Number(cashPayments._sum.amount || 0),
        refunds: Number(cashRefunds._sum.amount || 0),
        approvedExpenses: Number(cashExpenses._sum.amount || 0),
        netMovement: Number(cashPayments._sum.amount || 0) - Number(cashRefunds._sum.amount || 0) - Number(cashExpenses._sum.amount || 0),
      },
      refunds: Number(refunds._sum.amount || 0),
      receivables: Number(openReceivables._sum.balance || 0),
      deposits: {
        required: Number(requiredDeposits._sum.depositAmount || 0),
        collected: Number(collectedDeposits._sum.amount || 0),
      },
      departmentRevenue: {
        accommodation,
        restaurant,
        bar,
        pool,
        lateCheckout: totalLateCheckoutFees,
      },
    };
  }
}
