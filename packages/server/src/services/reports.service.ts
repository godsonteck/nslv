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

    // Pool swimmer headcount today
    const poolAttendanceToday = await prisma.poolAttendance.aggregate({
      where: { createdAt: { gte: startOfDay, lte: endOfDay } },
      _sum: { partySize: true },
      _count: { id: true },
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
      poolSwimmersToday: Number(poolAttendanceToday._sum.partySize || 0),
      poolGroupsToday: Number(poolAttendanceToday._count.id || 0),
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
    // Late-checkout folio items have referenceType='CHECKOUT' and description contains 'late'
    const lateFeeItems = await prisma.folioItem.findMany({
      where: {
        voidedAt: null,
        referenceType: 'CHECKOUT',
        description: { contains: 'late', mode: 'insensitive' },
        ...(whereDate ? { postedAt: whereDate } : {}),
      },
      select: { amount: true, quantity: true, folioId: true },
    });

    const seenFolios = new Set<string>();
    const uniqueLateItems = lateFeeItems.filter((item) => {
      if (seenFolios.has(item.folioId)) return false;
      seenFolios.add(item.folioId);
      return true;
    });
    const lateCheckOutsCount = uniqueLateItems.length;
    const totalLateCheckoutFees = uniqueLateItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    // Every folio that ever carried a non-voided late-checkout fee, so a refund
    // issued against one of them is attributed to late checkout even when the fee
    // was posted in an earlier period or the refund reason does not mention it.
    const lateFolioRows = await prisma.folioItem.findMany({
      where: {
        voidedAt: null,
        referenceType: 'CHECKOUT',
        description: { contains: 'late', mode: 'insensitive' },
      },
      select: { folioId: true },
    });
    const lateFolioIds = [...new Set(lateFolioRows.map((row) => row.folioId))];

    // Query any completed late-checkout refunds in the period
    const lateRefundPayments = await prisma.payment.findMany({
      where: {
        processedAt: whereDate,
        status: 'COMPLETED',
        type: 'REFUND',
        voidedAt: null,
        OR: [
          { description: { contains: 'late', mode: 'insensitive' } },
          { folioId: { in: lateFolioIds } },
        ],
      },
      select: { processedAt: true, amount: true, folioId: true },
    });
    const totalLateCheckoutRefunds = lateRefundPayments.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const netLateCheckoutFees = Math.max(0, totalLateCheckoutFees - totalLateCheckoutRefunds);

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

    // Pool swimmer/attendance headcount in period
    const poolAttendanceAgg = await prisma.poolAttendance.aggregate({
      where: { ...(whereDate ? { createdAt: whereDate } : {}) },
      _sum: { partySize: true },
      _count: { id: true },
    });
    const poolSwimmersCount = Number(poolAttendanceAgg._sum.partySize || 0);
    const poolGroupsCount = Number(poolAttendanceAgg._count.id || 0);

    // Pool transaction counts
    const poolTxCount = await prisma.poolTransaction.count({
      where: { ...(whereDate ? { createdAt: whereDate } : {}) },
    });

    // Restaurant & Bar order counts
    const restaurantOrderCount = await prisma.restaurantOrder.count({
      where: { ...(whereDate ? { createdAt: whereDate } : {}), status: { in: ['COMPLETED', 'SERVED'] } },
    });
    const barOrderCount = await prisma.barOrder.count({
      where: { ...(whereDate ? { createdAt: whereDate } : {}), status: { in: ['COMPLETED', 'SERVED'] } },
    });

    const [
      cashPayments,
      cardPayments,
      mobilePayments,
      bankTransferPayments,
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
      prisma.payment.aggregate({ where: { processedAt: whereDate, status: 'COMPLETED', type: 'PAYMENT', method: 'CARD', voidedAt: null }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { processedAt: whereDate, status: 'COMPLETED', type: 'PAYMENT', method: 'MOBILE_MONEY', voidedAt: null }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { processedAt: whereDate, status: 'COMPLETED', type: 'PAYMENT', method: 'BANK_TRANSFER', voidedAt: null }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { processedAt: whereDate, status: 'COMPLETED', type: 'REFUND', voidedAt: null }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { processedAt: whereDate, status: 'COMPLETED', type: 'REFUND', method: 'CASH', voidedAt: null }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { incurredOn: whereDate, status: 'APPROVED', paymentMethod: 'CASH' }, _sum: { amount: true } }),
      // Accommodation revenue = ACCOMMODATION folio items EXCLUDING late-checkout lines
      // Late-checkout items have referenceType='CHECKOUT' AND description contains 'late'
      prisma.folioItem.aggregate({
        where: {
          postedAt: whereDate,
          voidedAt: null,
          type: 'ACCOMMODATION',
          NOT: {
            AND: [
              { referenceType: 'CHECKOUT' },
              { description: { contains: 'late', mode: 'insensitive' } },
            ],
          },
        },
        _sum: { amount: true },
      }),
      prisma.folio.aggregate({ where: { status: 'OPEN' }, _sum: { balance: true } }),
      prisma.reservation.aggregate({ where: { createdAt: whereDate }, _sum: { depositAmount: true } }),
      prisma.payment.aggregate({ where: { processedAt: whereDate, status: 'COMPLETED', type: 'DEPOSIT', voidedAt: null }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { incurredOn: whereDate, status: 'APPROVED' }, _sum: { amount: true } }),
    ]);

    // Expenses breakdown by category
    const expenseRecords = await prisma.expense.findMany({
      where: { incurredOn: whereDate, status: 'APPROVED' },
      select: { id: true, category: true, amount: true, description: true, paymentMethod: true, incurredOn: true },
      orderBy: { incurredOn: 'desc' },
    });
    const expensesByCategory: Record<string, number> = {};
    for (const exp of expenseRecords) {
      const cat = exp.category || 'GENERAL';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(exp.amount || 0);
    }

    // Pool transaction method breakdown
    const poolTxByMethod = await prisma.poolTransaction.groupBy({
      by: ['paymentMethod'],
      where: { ...(whereDate ? { createdAt: whereDate } : {}) },
      _sum: { totalAmount: true },
      _count: { id: true },
    });
    const poolByMethod: Record<string, { amount: number; count: number }> = {};
    for (const row of poolTxByMethod) {
      poolByMethod[row.paymentMethod || 'CASH'] = {
        amount: Number(row._sum.totalAmount || 0),
        count: Number(row._count.id || 0),
      };
    }

    const restaurant = Number(restaurantSales._sum.totalAmount || 0);
    const bar = Number(barSales._sum.totalAmount || 0);
    const pool = Number(poolSales._sum.totalAmount || 0);
    const accommodation = Number(accommodationRevenue._sum.amount || 0);
    const totalExpenses = Number(approvedExpenses._sum.amount || 0);
    const totalRevenueAccrued = accommodation + restaurant + bar + pool + netLateCheckoutFees;

    // ADR (Average Daily Rate) and RevPAR (Revenue Per Available Room)
    const daysInPeriod = startDate && endDate ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))) : 30;
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
      const [allPayments, allExpenses, allRest, allBar, allPool, allCheckIns, allCheckOuts, allLateFees, allLateRefunds] = await Promise.all([
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
            referenceType: 'CHECKOUT',
            description: { contains: 'late', mode: 'insensitive' },
          },
          select: { postedAt: true, amount: true, folioId: true },
        }),
        prisma.payment.findMany({
          where: {
            processedAt: whereDate,
            status: 'COMPLETED',
            type: 'REFUND',
            voidedAt: null,
            OR: [
              { description: { contains: 'late', mode: 'insensitive' } },
              { folioId: { in: lateFolioIds } },
            ],
          },
          select: { processedAt: true, amount: true, folioId: true },
        }),
      ]);

      // De-duplicate late fee items by folioId within each day
      const deduplicateLateFeesByDay = (items: { postedAt: Date | null; amount: any; folioId: string }[], dStr: string) => {
        const dayItems = items.filter((l) => l.postedAt && l.postedAt.toISOString().slice(0, 10) === dStr);
        const seen = new Set<string>();
        return dayItems.filter((l) => {
          if (seen.has(l.folioId)) return false;
          seen.add(l.folioId);
          return true;
        });
      };

      while (curr <= endLimit) {
        const dStr = curr.toISOString().slice(0, 10);
        const dayOfWeek = dayNames[curr.getUTCDay()];

        const dayPay = allPayments.filter((p) => p.processedAt && p.processedAt.toISOString().slice(0, 10) === dStr).reduce((s, p) => s + Number(p.amount || 0), 0);
        const dayExp = allExpenses.filter((e) => e.incurredOn && e.incurredOn.toISOString().slice(0, 10) === dStr).reduce((s, e) => s + Number(e.amount || 0), 0);
        const dayRest = allRest.filter((r) => r.createdAt && r.createdAt.toISOString().slice(0, 10) === dStr).reduce((s, r) => s + Number(r.totalAmount || 0), 0);
        const dayBar = allBar.filter((b) => b.createdAt && b.createdAt.toISOString().slice(0, 10) === dStr).reduce((s, b) => s + Number(b.totalAmount || 0), 0);
        const dayPool = allPool.filter((pl) => pl.createdAt && pl.createdAt.toISOString().slice(0, 10) === dStr).reduce((s, pl) => s + Number(pl.totalAmount || 0), 0);
        // Deduplicated late fee items (one per folio)
        const dayLateUniq = deduplicateLateFeesByDay(allLateFees, dStr);
        const dayGrossLate = dayLateUniq.reduce((s, l) => s + Number(l.amount || 0), 0);
        const dayLateRefunds = allLateRefunds.filter((r) => r.processedAt && r.processedAt.toISOString().slice(0, 10) === dStr).reduce((s, r) => s + Number(r.amount || 0), 0);
        const dayNetLate = Math.max(0, dayGrossLate - dayLateRefunds);

        const dayIns = allCheckIns.filter((ci) => ci.actualCheckIn && ci.actualCheckIn.toISOString().slice(0, 10) === dStr);
        const dayOuts = allCheckOuts.filter((co) => co.actualCheckOut && co.actualCheckOut.toISOString().slice(0, 10) === dStr);
        const dayLateOuts = dayLateUniq.length;
        const dayPeople = dayIns.reduce((sum, ci) => sum + ((ci.reservation?.adults || 1) + (ci.reservation?.children || 0)), 0);

        // Accommodation = payments collected minus other departments minus net late fees
        const dayAccommodation = Math.max(0, dayPay - dayRest - dayBar - dayPool - dayNetLate);

        dailyBreakdown.push({
          date: dStr,
          dayName: dayOfWeek,
          revenue: dayPay,
          accommodation: dayAccommodation,
          restaurant: dayRest,
          bar: dayBar,
          pool: dayPool,
          lateFees: dayNetLate,
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

    // ─── Events & Event Spaces ───────────────────────────────────────────────
    const eventDateWhere = whereDate
      ? { OR: [{ startAt: whereDate }, { createdAt: whereDate }] }
      : {};

    const [eventsInPeriod, upcomingEvents, allEventSpaces] = await Promise.all([
      prisma.eventBooking.findMany({
        where: eventDateWhere,
        include: { eventSpace: { select: { name: true } }, createdBy: { select: { firstName: true, lastName: true } } },
        orderBy: { startAt: 'asc' },
      }),
      prisma.eventBooking.findMany({
        where: { startAt: { gte: new Date() }, status: 'CONFIRMED' },
        include: { eventSpace: { select: { name: true } } },
        orderBy: { startAt: 'asc' },
        take: 10,
      }),
      prisma.eventSpace.findMany({ where: { isActive: true }, select: { id: true, name: true, capacity: true } }),
    ]);

    const totalEventsInPeriod = eventsInPeriod.length;
    const confirmedEventsCount = eventsInPeriod.filter((e) => e.status === 'CONFIRMED').length;
    const cancelledEventsCount = eventsInPeriod.filter((e) => e.status === 'CANCELLED').length;
    const totalEventGuestCount = eventsInPeriod.reduce((sum, e) => sum + (e.guestCount || 0), 0);

    // Space utilization: count bookings per space in period
    const spaceUtilization: Record<string, { name: string; bookings: number; guests: number }> = {};
    for (const ev of eventsInPeriod) {
      const spaceName = ev.eventSpace?.name || 'Unassigned';
      if (!spaceUtilization[spaceName]) spaceUtilization[spaceName] = { name: spaceName, bookings: 0, guests: 0 };
      spaceUtilization[spaceName].bookings += 1;
      spaceUtilization[spaceName].guests += ev.guestCount || 0;
    }

    const events = {
      totalInPeriod: totalEventsInPeriod,
      confirmedCount: confirmedEventsCount,
      cancelledCount: cancelledEventsCount,
      totalGuestCount: totalEventGuestCount,
      totalEventSpaces: allEventSpaces.length,
      upcomingCount: upcomingEvents.length,
      spaceUtilization: Object.values(spaceUtilization),
      upcomingEvents: upcomingEvents.map((e) => ({
        id: e.id,
        title: e.title,
        spaceName: e.eventSpace?.name || 'Unassigned',
        startAt: e.startAt.toISOString(),
        endAt: e.endAt.toISOString(),
        guestCount: e.guestCount,
        status: e.status,
      })),
      recentEvents: eventsInPeriod.slice(0, 20).map((e) => ({
        id: e.id,
        title: e.title,
        spaceName: e.eventSpace?.name || 'Unassigned',
        startAt: e.startAt.toISOString(),
        endAt: e.endAt.toISOString(),
        guestCount: e.guestCount,
        status: e.status,
        contactName: e.contactName,
        createdByName: e.createdBy ? `${e.createdBy.firstName} ${e.createdBy.lastName}`.trim() : 'System',
      })),
    };

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
        totalLateCheckoutRefunds,
        netLateCheckoutFees,
      },
      pool: {
        swimmersCount: poolSwimmersCount,
        groupsCount: poolGroupsCount,
        transactionsCount: poolTxCount,
        revenue: pool,
        byMethod: poolByMethod,
      },
      foodAndBeverage: {
        restaurantOrderCount,
        barOrderCount,
        restaurantRevenue: restaurant,
        barRevenue: bar,
        totalFnBRevenue: restaurant + bar,
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
        paymentMethodBreakdown: {
          CASH: Number(cashPayments._sum.amount || 0),
          CARD: Number(cardPayments._sum.amount || 0),
          MOBILE_MONEY: Number(mobilePayments._sum.amount || 0),
          BANK_TRANSFER: Number(bankTransferPayments._sum.amount || 0),
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
          lateCheckout: netLateCheckoutFees,
        },
        expensesByCategory,
        expenseDetail: expenseRecords.map((e) => ({
          id: e.id,
          category: e.category || 'GENERAL',
          description: e.description || '',
          amount: Number(e.amount || 0),
          paymentMethod: e.paymentMethod || 'CASH',
          incurredOn: e.incurredOn ? e.incurredOn.toISOString().slice(0, 10) : '',
        })),
      },
      dailyBreakdown,
      events,
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
        lateCheckout: netLateCheckoutFees,
      },
    };
  }

  /**
   * Get Reception Shift & Operations Report
   * Dedicated reporting for Front Desk / Reception:
   * - Total MoMo & Cash collections with transaction logs
   * - Number of people booked (Adults & Children)
   * - Number of rooms booked and category breakdown
   * - Money taken from reception for expenses (itemized outflows & petty cash)
   * - Float reconciliation & shift handover balance
   */
  static async getReceptionReport(startDate?: Date, endDate?: Date) {
    const whereDate = startDate && endDate ? { gte: startDate, lte: endDate } : undefined;

    // Load staff user lookup map for human-readable names
    const users = await prisma.user.findMany({
      select: { id: true, firstName: true, lastName: true, username: true },
    });
    const userMap = new Map<string, string>();
    for (const u of users) {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
      userMap.set(u.id, name);
    }
    const getUserName = (id?: string | null) => (id ? userMap.get(id) || 'Staff' : 'Staff');

    // 1. Payments & Collections
    const [paymentsInPeriod, refundsInPeriod] = await Promise.all([
      prisma.payment.findMany({
        where: {
          processedAt: whereDate,
          status: 'COMPLETED',
          type: { in: ['PAYMENT', 'DEPOSIT'] },
          voidedAt: null,
        },
        include: {
          guest: { select: { firstName: true, lastName: true, phone: true } },
          reservation: {
            select: {
              confirmationNo: true,
              room: { select: { number: true, roomType: { select: { name: true } } } },
            },
          },
        },
        orderBy: { processedAt: 'desc' },
      }),
      prisma.payment.findMany({
        where: {
          processedAt: whereDate,
          status: 'COMPLETED',
          type: 'REFUND',
          voidedAt: null,
        },
        include: {
          guest: { select: { firstName: true, lastName: true } },
          reservation: { select: { confirmationNo: true } },
        },
        orderBy: { processedAt: 'desc' },
      }),
    ]);

    let totalMomoAmount = 0;
    let totalCashAmount = 0;
    let totalCardAmount = 0;
    let totalBankAmount = 0;
    let otherAmount = 0;

    const momoTransactions: Array<{
      id: string;
      amount: number;
      reference: string;
      description: string;
      guestName: string;
      phone: string;
      roomNumber: string;
      confirmationNo: string;
      processedBy: string;
      processedAt: string;
    }> = [];

    const cashTransactions: Array<{
      id: string;
      amount: number;
      description: string;
      guestName: string;
      roomNumber: string;
      confirmationNo: string;
      processedBy: string;
      processedAt: string;
    }> = [];

    const allPaymentRecords: Array<{
      id: string;
      amount: number;
      method: string;
      reference: string;
      description: string;
      guestName: string;
      roomNumber: string;
      confirmationNo: string;
      processedBy: string;
      processedAt: string;
      type: string;
    }> = [];

    for (const p of paymentsInPeriod) {
      const amt = Number(p.amount || 0);
      const guestName = p.guest
        ? `${p.guest.firstName || ''} ${p.guest.lastName || ''}`.trim()
        : 'Guest';
      const guestPhone = p.guest?.phone || '—';
      const roomNum = p.reservation?.room?.number ? `Room ${p.reservation.room.number}` : '—';
      const confNo = p.reservation?.confirmationNo || '—';
      const staff = getUserName(p.processedBy);
      const procAt = p.processedAt.toISOString();

      if (p.method === 'MOBILE_MONEY') {
        totalMomoAmount += amt;
        momoTransactions.push({
          id: p.id,
          amount: amt,
          reference: p.reference || '—',
          description: p.description || 'Mobile Money payment',
          guestName,
          phone: guestPhone,
          roomNumber: roomNum,
          confirmationNo: confNo,
          processedBy: staff,
          processedAt: procAt,
        });
      } else if (p.method === 'CASH') {
        totalCashAmount += amt;
        cashTransactions.push({
          id: p.id,
          amount: amt,
          description: p.description || 'Cash payment',
          guestName,
          roomNumber: roomNum,
          confirmationNo: confNo,
          processedBy: staff,
          processedAt: procAt,
        });
      } else if (p.method === 'CARD') {
        totalCardAmount += amt;
      } else if (p.method === 'BANK_TRANSFER') {
        totalBankAmount += amt;
      } else {
        otherAmount += amt;
      }

      allPaymentRecords.push({
        id: p.id,
        amount: amt,
        method: p.method,
        reference: p.reference || '—',
        description: p.description || '',
        guestName,
        roomNumber: roomNum,
        confirmationNo: confNo,
        processedBy: staff,
        processedAt: procAt,
        type: p.type,
      });
    }

    const totalRefunds = refundsInPeriod.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const cashRefunds = refundsInPeriod
      .filter((r) => r.method === 'CASH')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const totalCollections = totalMomoAmount + totalCashAmount + totalCardAmount + totalBankAmount + otherAmount;
    const netCollections = totalCollections - totalRefunds;

    // 2. Bookings, People Headcount & Room Category Breakdown
    const reservationsInPeriod = await prisma.reservation.findMany({
      where: {
        OR: [
          { createdAt: whereDate },
          { checkInDate: whereDate },
        ],
      },
      include: {
        room: {
          include: {
            roomType: true,
          },
        },
        guests: {
          include: {
            guest: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeReservations = reservationsInPeriod.filter((r) => r.status !== 'CANCELLED');
    const totalBookingsCount = reservationsInPeriod.length;
    const activeBookingsCount = activeReservations.length;
    const cancelledBookingsCount = reservationsInPeriod.filter((r) => r.status === 'CANCELLED').length;

    let totalAdults = 0;
    let totalChildren = 0;
    let totalRoomNights = 0;
    const uniqueRoomIds = new Set<string>();

    // Room Category Breakdown Map
    const categoryMap = new Map<string, {
      categoryName: string;
      basePrice: number;
      bookingsCount: number;
      roomNights: number;
      adults: number;
      children: number;
      totalPeople: number;
      totalRevenue: number;
      depositCollected: number;
      rooms: Set<string>;
    }>();

    const bookingList: Array<{
      id: string;
      confirmationNo: string;
      guestName: string;
      phone: string;
      roomNumber: string;
      categoryName: string;
      checkInDate: string;
      checkOutDate: string;
      nights: number;
      adults: number;
      children: number;
      totalPeople: number;
      status: string;
      source: string;
      totalAmount: number;
      depositAmount: number;
      createdAt: string;
    }> = [];

    for (const r of reservationsInPeriod) {
      const primaryGuest = r.guests?.[0]?.guest;
      const guestName = primaryGuest
        ? `${primaryGuest.firstName || ''} ${primaryGuest.lastName || ''}`.trim()
        : 'Guest';
      const phone = primaryGuest?.phone || '—';
      const roomNum = r.room?.number || '—';
      const categoryName = r.room?.roomType?.name || 'Standard';
      const basePrice = Number(r.room?.roomType?.basePrice || r.baseRate || 0);

      const checkIn = new Date(r.checkInDate);
      const checkOut = new Date(r.checkOutDate);
      const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
      const adults = r.adults || 1;
      const children = r.children || 0;
      const totalPeople = adults + children;
      const totalAmt = Number(r.totalAmount || 0);
      const depAmt = Number(r.depositAmount || 0);

      if (r.status !== 'CANCELLED') {
        totalAdults += adults;
        totalChildren += children;
        totalRoomNights += nights;
        if (r.roomId) uniqueRoomIds.add(r.roomId);

        // Accumulate into category
        let cat = categoryMap.get(categoryName);
        if (!cat) {
          cat = {
            categoryName,
            basePrice,
            bookingsCount: 0,
            roomNights: 0,
            adults: 0,
            children: 0,
            totalPeople: 0,
            totalRevenue: 0,
            depositCollected: 0,
            rooms: new Set<string>(),
          };
          categoryMap.set(categoryName, cat);
        }
        cat.bookingsCount += 1;
        cat.roomNights += nights;
        cat.adults += adults;
        cat.children += children;
        cat.totalPeople += totalPeople;
        cat.totalRevenue += totalAmt;
        cat.depositCollected += depAmt;
        if (r.room?.number) cat.rooms.add(r.room.number);
      }

      bookingList.push({
        id: r.id,
        confirmationNo: r.confirmationNo,
        guestName,
        phone,
        roomNumber: roomNum,
        categoryName,
        checkInDate: r.checkInDate.toISOString().slice(0, 10),
        checkOutDate: r.checkOutDate.toISOString().slice(0, 10),
        nights,
        adults,
        children,
        totalPeople,
        status: r.status,
        source: r.source,
        totalAmount: totalAmt,
        depositAmount: depAmt,
        createdAt: r.createdAt.toISOString(),
      });
    }

    const categoriesBreakdown = Array.from(categoryMap.values()).map((c) => ({
      categoryName: c.categoryName,
      basePrice: c.basePrice,
      bookingsCount: c.bookingsCount,
      roomNights: c.roomNights,
      adults: c.adults,
      children: c.children,
      totalPeople: c.totalPeople,
      totalRevenue: c.totalRevenue,
      depositCollected: c.depositCollected,
      uniqueRoomsCount: c.rooms.size,
      roomsList: Array.from(c.rooms).sort().join(', '),
      percentageShare: activeBookingsCount > 0 ? Math.round((c.bookingsCount / activeBookingsCount) * 100) : 0,
    })).sort((a, b) => b.totalRevenue - a.totalRevenue);

    const totalPeopleBooked = totalAdults + totalChildren;
    const totalRoomsBooked = uniqueRoomIds.size;

    // 3. Money Taken from Reception for Expenses (Outflows & Petty Cash)
    // Query cash register outflow entries
    const cashRegisterEntries = await prisma.cashRegisterEntry.findMany({
      where: {
        cashRegister: whereDate ? { businessDate: whereDate } : undefined,
      },
      include: {
        cashRegister: { select: { businessDate: true } },
      },
      orderBy: { recordedAt: 'desc' },
    });

    const outflowEntries = cashRegisterEntries.filter((e) => e.type === 'OUTFLOW');
    const openingEntries = cashRegisterEntries.filter((e) => e.type === 'OPENING');
    const manualInflowEntries = cashRegisterEntries.filter((e) => e.type === 'INFLOW' && e.category !== 'BANK_DEPOSIT');
    const bankDepositEntries = cashRegisterEntries.filter((e) => e.category === 'BANK_DEPOSIT' || (e.description && e.description.toLowerCase().includes('bank')));

    // Also fetch approved cash expenses from Expense table for comprehensive reconciliation
    const approvedCashExpenses = await prisma.expense.findMany({
      where: {
        incurredOn: whereDate,
        status: 'APPROVED',
        paymentMethod: 'CASH',
      },
      orderBy: { incurredOn: 'desc' },
    });

    // Expenses itemized list
    const expenseDisbursements: Array<{
      id: string;
      date: string;
      time: string;
      amount: number;
      category: string;
      description: string;
      recipient: string;
      receiptRef: string;
      recordedBy: string;
      source: 'REGISTER_OUTFLOW' | 'EXPENSE_RECORD';
    }> = [];

    const expenseCategoryMap: Record<string, number> = {};
    let totalReceptionExpenses = 0;

    for (const out of outflowEntries) {
      const amt = Number(out.amount || 0);
      const cat = out.category || 'GENERAL_EXPENSE';
      totalReceptionExpenses += amt;
      expenseCategoryMap[cat] = (expenseCategoryMap[cat] || 0) + amt;

      expenseDisbursements.push({
        id: out.id,
        date: out.recordedAt.toISOString().slice(0, 10),
        time: out.recordedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        amount: amt,
        category: cat,
        description: out.description || 'Cash outflow',
        recipient: out.recipient || '—',
        receiptRef: out.receiptRef || '—',
        recordedBy: getUserName(out.recordedBy),
        source: 'REGISTER_OUTFLOW',
      });
    }

    // Add any approved cash expense not already in cash register entries
    for (const exp of approvedCashExpenses) {
      const alreadyInList = expenseDisbursements.some(
        (d) => d.receiptRef === exp.receiptRef || (d.amount === Number(exp.amount) && d.description.includes(exp.expenseNo))
      );
      if (!alreadyInList) {
        const amt = Number(exp.amount || 0);
        const cat = exp.category || 'GENERAL';
        expenseCategoryMap[cat] = (expenseCategoryMap[cat] || 0) + amt;
        totalReceptionExpenses += amt;

        expenseDisbursements.push({
          id: exp.id,
          date: exp.incurredOn.toISOString().slice(0, 10),
          time: exp.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          amount: amt,
          category: cat,
          description: `${exp.expenseNo}: ${exp.description || 'Cash Expense'}`,
          recipient: exp.vendor || '—',
          receiptRef: exp.receiptRef || exp.expenseNo,
          recordedBy: getUserName(exp.createdBy),
          source: 'EXPENSE_RECORD',
        });
      }
    }

    const expensesByCategory = Object.entries(expenseCategoryMap).map(([category, amount]) => ({
      category,
      amount,
      percentage: totalReceptionExpenses > 0 ? Math.round((amount / totalReceptionExpenses) * 100) : 0,
    })).sort((a, b) => b.amount - a.amount);

    // 4. Cash Float & Handover Reconciliation
    const totalOpeningCash = openingEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalManualInflows = manualInflowEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalBankDeposits = bankDepositEntries.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    // Net expected cash at reception = Opening float + Cash collected at front desk + Manual inflows - Money taken for expenses - Cash refunds - Bank deposits
    const expectedCashAtHand = Math.max(
      0,
      totalOpeningCash + totalCashAmount + totalManualInflows - totalReceptionExpenses - cashRefunds - totalBankDeposits
    );

    // 5. Operations: Check-ins and Check-outs in period
    const [checkInsCount, checkOutsCount, activeStaysCount] = await Promise.all([
      prisma.checkIn.count({ where: { actualCheckIn: whereDate } }),
      prisma.checkOut.count({ where: { actualCheckOut: whereDate } }),
      prisma.checkIn.count({ where: { reservation: { status: 'CHECKED_IN' } } }),
    ]);

    // Late checkout fees in period
    const lateFeeItems = await prisma.folioItem.findMany({
      where: {
        voidedAt: null,
        referenceType: 'CHECKOUT',
        description: { contains: 'late', mode: 'insensitive' },
        ...(whereDate ? { postedAt: whereDate } : {}),
      },
      select: { amount: true, quantity: true, folioId: true },
    });
    const totalLateFees = lateFeeItems.reduce((sum, l) => sum + Number(l.amount || 0), 0);

    return {
      period: {
        startDate: startDate ? startDate.toISOString().slice(0, 10) : undefined,
        endDate: endDate ? endDate.toISOString().slice(0, 10) : undefined,
      },
      financialSummary: {
        totalCollections,
        netCollections,
        totalRefunds,
        momo: {
          totalAmount: totalMomoAmount,
          count: momoTransactions.length,
          transactions: momoTransactions,
        },
        cash: {
          totalAmount: totalCashAmount,
          count: cashTransactions.length,
          transactions: cashTransactions,
        },
        card: {
          totalAmount: totalCardAmount,
          count: paymentsInPeriod.filter((p) => p.method === 'CARD').length,
        },
        bankTransfer: {
          totalAmount: totalBankAmount,
          count: paymentsInPeriod.filter((p) => p.method === 'BANK_TRANSFER').length,
        },
        other: {
          totalAmount: otherAmount,
        },
        allPaymentRecords,
      },
      bookingSummary: {
        totalBookings: totalBookingsCount,
        activeBookings: activeBookingsCount,
        cancelledBookings: cancelledBookingsCount,
        totalPeople: totalPeopleBooked,
        adults: totalAdults,
        children: totalChildren,
        totalRoomsBooked,
        totalRoomNights,
        categories: categoriesBreakdown,
        bookingsList: bookingList,
      },
      expensesSummary: {
        totalTakenForExpenses: totalReceptionExpenses,
        disbursementsCount: expenseDisbursements.length,
        byCategory: expensesByCategory,
        disbursementsList: expenseDisbursements,
      },
      cashReconciliation: {
        openingCashFloat: totalOpeningCash,
        cashCollectionsReceived: totalCashAmount,
        manualInflows: totalManualInflows,
        moneyTakenForExpenses: totalReceptionExpenses,
        cashRefundsPaid: cashRefunds,
        cashDepositedToBank: totalBankDeposits,
        expectedCashAtHand,
      },
      operationalHighlights: {
        checkInsCount,
        checkOutsCount,
        activeStaysCount,
        lateCheckoutsCount: lateFeeItems.length,
        totalLateFees,
      },
    };
  }
}

