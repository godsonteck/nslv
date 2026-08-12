// ============================================
// NS LUXURY VILLA — Check-In & Check-Out Stay Service
// ============================================

import { prisma } from '../config';

export interface CheckInDTO {
  reservationId: string;
  checkedInBy: string;
  idVerified?: boolean;
  idDocumentType?: string;
  idDocumentNumber?: string;
  notes?: string;
}

export interface CheckOutDTO {
  reservationId: string;
  checkedOutBy: string;
  roomCondition?: 'DIRTY' | 'CLEAN' | 'DAMAGED';
  paymentMethod?: string;
  notes?: string;
}

export class StayService {
  /** Get active stays */
  static async getActiveStays() {
    return prisma.checkIn.findMany({
      where: {
        reservation: { status: 'CHECKED_IN' },
      },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        reservation: {
          include: {
            folios: {
              include: {
                items: true,
                payments: true,
              },
            },
          },
        },
      },
      orderBy: { actualCheckIn: 'desc' },
    });
  }

  /** Execute Check-In workflow */
  static async checkInGuest(data: CheckInDTO) {
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: data.reservationId },
        include: {
          guests: { where: { isPrimary: true } },
          room: true,
        },
      });

      if (!reservation) throw new Error('Reservation not found');
      if (reservation.status === 'CHECKED_IN') throw new Error('Guest is already checked in');
      if (reservation.status === 'CANCELLED') throw new Error('Cannot check in a cancelled reservation');

      const primaryGuestId = reservation.guests[0]?.guestId;
      if (!primaryGuestId) throw new Error('No primary guest linked to reservation');

      // Create CheckIn record
      const checkIn = await tx.checkIn.create({
        data: {
          reservationId: reservation.id,
          roomId: reservation.roomId,
          guestId: primaryGuestId,
          checkedInBy: data.checkedInBy,
          idVerified: data.idVerified ?? true,
          idDocumentType: data.idDocumentType,
          idDocumentNumber: data.idDocumentNumber,
          notes: data.notes,
        },
      });

      // Update reservation status
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'CHECKED_IN' },
      });

      // Update room status
      await tx.room.update({
        where: { id: reservation.roomId },
        data: { status: 'OCCUPIED' },
      });

      // Create or find open Folio
      let folio = await tx.folio.findFirst({
        where: { reservationId: reservation.id, status: 'OPEN' },
      });

      if (!folio) {
        folio = await tx.folio.create({
          data: {
            reservationId: reservation.id,
            guestId: primaryGuestId,
            status: 'OPEN',
            balance: reservation.totalAmount,
          },
        });

        // Add accommodation charge item
        await tx.folioItem.create({
          data: {
            folioId: folio.id,
            type: 'ACCOMMODATION',
            description: `Accommodation (${reservation.room?.number || 'Room'})`,
            amount: reservation.totalAmount,
            quantity: 1,
            unitPrice: reservation.totalAmount,
            department: 'FRONT_DESK',
            postedBy: data.checkedInBy,
          },
        });
      }

      return { checkIn, folio };
    });
  }

  /** Execute Check-Out workflow */
  static async checkOutGuest(data: CheckOutDTO) {
    return prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: data.reservationId },
        include: {
          guests: { where: { isPrimary: true } },
          folios: {
            include: { items: true, payments: true },
          },
        },
      });

      if (!reservation) throw new Error('Reservation not found');
      if (reservation.status !== 'CHECKED_IN') throw new Error('Stay is not currently active for check-out');

      const primaryGuestId = reservation.guests[0]?.guestId;
      if (!primaryGuestId) throw new Error('No primary guest linked to reservation');

      const folio = reservation.folios.find((f) => f.status === 'OPEN') || reservation.folios[0];
      const finalBalance = folio ? Number(folio.balance) : 0;

      if (finalBalance > 0) {
        throw new Error(`Outstanding balance of GHS ${finalBalance.toFixed(2)} must be paid before check-out.`);
      }

      // Create CheckOut record
      const checkOut = await tx.checkOut.create({
        data: {
          reservationId: reservation.id,
          roomId: reservation.roomId,
          guestId: primaryGuestId,
          checkedOutBy: data.checkedOutBy,
          roomCondition: data.roomCondition || 'DIRTY',
          finalBalance,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
        },
      });

      // Update reservation status
      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: 'CHECKED_OUT' },
      });

      // Update room status
      await tx.room.update({
        where: { id: reservation.roomId },
        data: { status: data.roomCondition === 'DIRTY' ? 'DIRTY' : 'AVAILABLE' },
      });

      // Close Folio
      if (folio) {
        await tx.folio.update({
          where: { id: folio.id },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
      }

      return { checkOut, folio };
    });
  }
}
