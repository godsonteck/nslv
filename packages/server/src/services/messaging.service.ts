// ============================================
// NS LUXURY VILLA — Outbound Messaging Outbox
// Email and WhatsApp messages are written to the database first. A provider
// adapter (or an operator) can deliver them later without ever blocking a
// booking or payment transaction.
// ============================================

import { prisma } from '../config';
import { MessageChannel, MessageStatus } from '@prisma/client';

export interface QueueMessageInput {
  channel: MessageChannel | 'EMAIL' | 'WHATSAPP';
  recipient: string;
  subject?: string | null;
  body: string;
  template?: string | null;
  payload?: Record<string, unknown> | null;
  relatedType?: string | null;
  relatedId?: string | null;
}

export interface ListMessagesFilters {
  status?: string;
  channel?: string;
  page?: number;
  pageSize?: number;
}

export class MessagingService {
  /** Queue a message for delivery. Never throws into the caller's business flow. */
  static async queue(input: QueueMessageInput) {
    try {
      return await prisma.messageOutbox.create({
        data: {
          channel: input.channel as MessageChannel,
          recipient: input.recipient.trim(),
          subject: input.subject?.trim() || null,
          body: input.body,
          template: input.template || null,
          payload: input.payload ? JSON.stringify(input.payload) : null,
          relatedType: input.relatedType || null,
          relatedId: input.relatedId || null,
        },
      });
    } catch (error) {
      // The outbox is intentionally best-effort: a messaging failure must never
      // roll back a confirmed reservation or a recorded payment.
      console.error('[MESSAGING] Failed to queue message:', error);
      return null;
    }
  }

  static async queueEmail(input: Omit<QueueMessageInput, 'channel'>) {
    return this.queue({ ...input, channel: 'EMAIL' });
  }

  static async queueWhatsApp(input: Omit<QueueMessageInput, 'channel'>) {
    return this.queue({ ...input, channel: 'WHATSAPP' });
  }

  static async list(filters: ListMessagesFilters = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 25));
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.channel) where.channel = filters.channel;

    const [items, total] = await Promise.all([
      prisma.messageOutbox.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.messageOutbox.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /** Mark a message as delivered (used by the mock console adapter or a worker). */
  static async markSent(id: string) {
    return prisma.messageOutbox.update({
      where: { id },
      data: { status: MessageStatus.SENT, sentAt: new Date(), lastError: null },
    });
  }

  /** Return a failed message to the queue for another attempt. */
  static async retry(id: string) {
    return prisma.messageOutbox.update({
      where: { id },
      data: { status: MessageStatus.PENDING, lastError: null },
    });
  }

  static async markFailed(id: string, error: string) {
    return prisma.messageOutbox.update({
      where: { id },
      data: {
        status: MessageStatus.FAILED,
        attempts: { increment: 1 },
        lastError: error.slice(0, 1000),
      },
    });
  }
}
