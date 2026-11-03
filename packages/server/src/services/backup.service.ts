// ============================================
// NS LUXURY VILLA — Data Backup & Snapshot Recovery Service
// Allows creating, previewing, restoring and downloading system snapshots
// ============================================

import fs from 'fs';
import path from 'path';
import { prisma } from '../config';
import { AppError } from '../middleware/error';
import { AuditService } from './audit.service';

// Snapshots must never live inside the repository: the repo is public, and on
// Vercel the working directory is read-only. Allow an explicit destination.
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), '.backups'));

export interface BackupMetadata {
  id: string;
  filename: string;
  createdAt: string;
  createdBy: string;
  trigger: 'MANUAL' | 'PRE_RESET_SNAPSHOT' | 'AUTO_SCHEDULED';
  description?: string;
  totalRecords: number;
  fileSizeBytes: number;
  modelsCount: Record<string, number>;
}

export interface BackupPayload {
  metadata: BackupMetadata;
  data: Record<string, any[]>;
}

// Ordered list for restoration: dependencies must be inserted before dependents
export const RESTORE_ORDER = [
  // 1. Settings & Branding
  'systemSetting',
  'brandingTheme',

  // 2. Room definitions
  'roomType',
  'roomAmenity',
  'roomTypeAmenity',
  'room',

  // 3. Catalogs & Categories
  'itemCategory',
  'restaurantItem',
  'barItem',
  'poolService',
  'inventoryItem',
  'eventSpace',

  // 4. Financial & Registers
  'cashRegister',
  'cashRegisterEntry',
  'dailyClose',
  'expense',

  // 5. Guests, Stays & Reservations
  'guest',
  'reservation',
  'reservationGuest',
  'checkIn',
  'checkOut',
  'folio',
  'payment',
  'folioItem',

  // 6. POS Orders
  'restaurantOrder',
  'restaurantOrderItem',
  'barOrder',
  'barOrderItem',

  // 7. Operations & Logs
  'poolAttendance',
  'poolTransaction',
  'eventBooking',
  'inventoryMovement',
  'notification',
  'auditLog',
] as const;

export class BackupService {
  /**
   * Ensure the backup directory exists
   */
  private static ensureBackupDir(): string {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    return BACKUP_DIR;
  }

  /**
   * Create a full point-in-time snapshot of the database
   */
  static async createSnapshot(
    userId: string,
    trigger: 'MANUAL' | 'PRE_RESET_SNAPSHOT' | 'AUTO_SCHEDULED' = 'MANUAL',
    options?: { description?: string; modules?: any },
  ): Promise<BackupMetadata> {
    this.ensureBackupDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const id = `backup_${timestamp}_${Math.random().toString(36).slice(2, 7)}`;
    const filename = `${id}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    const snapshotData: Record<string, any[]> = {};
    const modelsCount: Record<string, number> = {};
    let totalRecords = 0;

    // Fetch all records for each restorable model
    for (const model of RESTORE_ORDER) {
      try {
        const client = (prisma as any)[model];
        if (client && typeof client.findMany === 'function') {
          const records = await client.findMany();
          snapshotData[model] = records;
          modelsCount[model] = records.length;
          totalRecords += records.length;
        }
      } catch (err) {
        snapshotData[model] = [];
        modelsCount[model] = 0;
      }
    }

    const metadata: BackupMetadata = {
      id,
      filename,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      trigger,
      description: options?.description || (trigger === 'PRE_RESET_SNAPSHOT' ? 'Automatic safety snapshot before system reset' : 'Manual database snapshot'),
      totalRecords,
      fileSizeBytes: 0,
      modelsCount,
    };

    const payload: BackupPayload = {
      metadata,
      data: snapshotData,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    fs.writeFileSync(filePath, jsonString, 'utf-8');
    const stats = fs.statSync(filePath);
    metadata.fileSizeBytes = stats.size;

    // Update the file with the exact file size in metadata
    payload.metadata.fileSizeBytes = stats.size;
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');

    await AuditService.log({
      userId,
      action: 'SYSTEM_BACKUP_CREATED',
      resource: 'BACKUP',
      resourceId: id,
      afterData: { id, trigger, totalRecords, fileSizeBytes: stats.size },
    }).catch(() => null);

    return metadata;
  }

  /**
   * List all available snapshots on disk
   */
  static listSnapshots(): BackupMetadata[] {
    this.ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));

    const list: BackupMetadata[] = [];

    for (const f of files) {
      try {
        const filePath = path.join(BACKUP_DIR, f);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed?.metadata?.id) {
          list.push(parsed.metadata);
        }
      } catch (err) {
        // Ignore corrupted file
      }
    }

    // Sort newest first
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Read the full snapshot payload by ID
   */
  static getSnapshot(id: string): BackupPayload {
    this.ensureBackupDir();
    const wanted = decodeURIComponent(id).trim().replace(/\.json$/, '');
    const allFiles = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));

    // Exact filename match only. `includes()` matched unrelated snapshots whose
    // id happened to be a substring, which could act on the wrong backup.
    const match = allFiles.find((f) => f.replace(/\.json$/, '') === wanted);

    if (!match) {
      throw new AppError('Snapshot not found.', 404, 'SNAPSHOT_NOT_FOUND');
    }

    const filePath = path.join(BACKUP_DIR, match);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as BackupPayload;
  }

  /**
   * Restore a snapshot into the database
   */
  static async restoreSnapshot(userId: string, id: string): Promise<{ restoredRecords: number; modelsRestored: Record<string, number> }> {
    const payload = this.getSnapshot(id);
    const data = payload.data;
    const modelsRestored: Record<string, number> = {};
    let totalRestored = 0;
    const failures: string[] = [];

    await prisma.$transaction(
      async (tx) => {
        // Restore in strict topological dependency order
        for (const model of RESTORE_ORDER) {
          const records = data[model];
          if (!records || !Array.isArray(records) || records.length === 0) {
            modelsRestored[model] = 0;
            continue;
          }

          const client = (tx as any)[model];
          if (!client) continue;

          let count = 0;
          for (const record of records) {
            try {
              // Clean date fields from strings to Dates
              const cleanRecord = { ...record };
              for (const [k, v] of Object.entries(cleanRecord)) {
                if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
                  cleanRecord[k] = new Date(v);
                }
              }

              // Primary key handling: upsert by id if has id, or findUnique
              if (cleanRecord.id) {
                await client.upsert({
                  where: { id: cleanRecord.id },
                  create: cleanRecord,
                  update: cleanRecord,
                });
                count++;
              } else if (cleanRecord.key && (model as string) === 'systemSetting') {
                await client.upsert({
                  where: { key: cleanRecord.key },
                  create: cleanRecord,
                  update: cleanRecord,
                });
                count++;
              } else if (cleanRecord.businessDate && ((model as string) === 'cashRegister' || (model as string) === 'dailyClose')) {
                await client.upsert({
                  where: { businessDate: new Date(cleanRecord.businessDate) },
                  create: cleanRecord,
                  update: cleanRecord,
                });
                count++;
              } else {
                try {
                  await client.create({ data: cleanRecord });
                  count++;
                } catch (createErr) {
                  failures.push(`${model}:${cleanRecord.id ?? 'unknown'} — ${(createErr as Error).message}`);
                }
              }
            } catch (insertErr) {
              failures.push(`${model}:${(record as { id?: string }).id ?? 'unknown'} — ${(insertErr as Error).message}`);
            }
          }

          modelsRestored[model] = count;
          totalRestored += count;
        }

        if (failures.length > 0) {
          // Roll the whole restore back. Reporting success while silently
          // dropping rows is worse than refusing the restore.
          throw new AppError(
            `Restore incomplete: ${failures.length} record(s) could not be written. First: ${failures[0]}`,
            422,
            'RESTORE_INCOMPLETE',
          );
        }
      },
      { timeout: 30000 }
    );

    await AuditService.log({
      userId,
      action: 'SYSTEM_BACKUP_RESTORED',
      resource: 'BACKUP',
      resourceId: id,
      afterData: { id, totalRestored, modelsRestored, restoredAt: new Date().toISOString() },
    }).catch(() => null);

    return {
      restoredRecords: totalRestored,
      modelsRestored,
    };
  }

  /**
   * Delete an old backup file
   */
  static deleteSnapshot(userId: string, id: string): boolean {
    this.ensureBackupDir();
    const wanted = decodeURIComponent(id).trim().replace(/\.json$/, '');
    const allFiles = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'));

    // Exact filename match only. `includes()` matched unrelated snapshots whose
    // id happened to be a substring, which could act on the wrong backup.
    const match = allFiles.find((f) => f.replace(/\.json$/, '') === wanted);

    if (!match) {
      throw new AppError(`Snapshot "${id}" not found.`, 404, 'SNAPSHOT_NOT_FOUND');
    }

    const filePath = path.join(BACKUP_DIR, match);
    try {
      fs.unlinkSync(filePath);
    } catch (err: any) {
      throw new AppError(`Failed to delete snapshot file: ${err.message}`, 500, 'DELETE_FAILED');
    }

    AuditService.log({
      userId,
      action: 'SYSTEM_BACKUP_DELETED',
      resource: 'BACKUP',
      resourceId: id,
    }).catch(() => null);

    return true;
  }
}
