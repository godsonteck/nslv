// ============================================
// NS LUXURY VILLA — Data Import Service
// Upload a CSV / Excel-export / pasted table and
// auto-fill POS menus, pool services and inventory.
// ============================================

import { prisma } from '../config';

export type ImportTarget = 'MENU' | 'BAR' | 'POOL' | 'INVENTORY' | 'STOCK';

// Operational safety limits for document imports
export const IMPORT_LIMITS = {
  maxRows: 1000, // rows processed per run (excluding header)
  maxColumns: 100,
  maxCellLength: 500,
};

export interface ImportMapping {
  name?: string;
  price?: string;
  category?: string;
  description?: string;
  sku?: string;
  unit?: string;
  quantity?: string;
  minQuantity?: string;
  costPrice?: string;
  notes?: string;
}

export interface ImportDefaults {
  category?: string;
  unit?: string;
  quantity?: string;
  minQuantity?: string;
  costPrice?: string;
}

/** Split one logical line into cells, honouring quoted CSV fields. */
function splitLine(line: string, delimiter: string): string[] {
  if (delimiter === 'WHITESPACE') {
    return line
      .split(/\s{2,}|\t+/)
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);
  }

  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function detectDelimiter(firstLine: string): string {
  const candidates = [',', '\t', ';', '|'];
  let best = ',';
  let bestCount = 0;
  for (const c of candidates) {
    const count = firstLine.split(c).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = c;
    }
  }
  return best;
}

export class ImportService {
  /** Parse a raw document into a header row + data rows. */
  static parse(content: string, format: 'csv' | 'tsv' | 'text' | 'pdf' | 'doc' | 'docx' | 'auto' = 'auto') {
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normalized) throw new Error('The document is empty.');
    const lines = normalized
      .replace(/\u00a0/g, ' ')
      .split('\n')
      .map((line) => line.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) throw new Error('The document contains no rows.');

    let delimiter: string;
    if (format === 'tsv') delimiter = '\t';
    else if (format === 'csv') delimiter = ',';
    else if (format === 'text') delimiter = detectDelimiter(lines[0]);
    else if (format === 'pdf' || format === 'doc' || format === 'docx' || format === 'auto') {
      const first = lines[0];
      if (first.includes('\t')) delimiter = '\t';
      else if (/\s{2,}/.test(first)) delimiter = 'WHITESPACE';
      else delimiter = detectDelimiter(first);
    } else {
      delimiter = detectDelimiter(lines[0]);
    }

    const rows = lines.map((l) => splitLine(l, delimiter));
    const filteredRows = rows.filter((row) => row.some((cell) => cell && cell.trim().length > 0));
    if (filteredRows.length === 0) throw new Error('The document contains no rows.');
    if (filteredRows[0].length > IMPORT_LIMITS.maxColumns) {
      throw new Error(`The document has too many columns (max ${IMPORT_LIMITS.maxColumns}).`);
    }
    const columns = filteredRows[0].map((c, i) => c.trim() || `Column ${i + 1}`);
    const data = filteredRows.slice(1).map((r) => r.map((c) => c.trim()));

    return { columns, rows: data };
  }

  /**
   * Create / update records from a parsed document.
   * Items that already exist (by name / sku) are skipped.
   */
  static async run(
    target: ImportTarget,
    payload: {
      columns: string[];
      rows: string[][];
      mapping: ImportMapping;
      defaults?: ImportDefaults;
    },
    createdBy?: string,
  ) {
    const { columns, rows, mapping, defaults } = payload;

    if (!Array.isArray(rows) || !Array.isArray(columns)) {
      throw new Error('Invalid import payload — rows and columns must be arrays.');
    }
    if (rows.length === 0) throw new Error('The document contains no data rows to import.');
    if (rows.length > IMPORT_LIMITS.maxRows) {
      throw new Error(`Too many rows (${rows.length}). Maximum allowed is ${IMPORT_LIMITS.maxRows} per import.`);
    }
    if (columns.length > IMPORT_LIMITS.maxColumns) {
      throw new Error(`Too many columns (${columns.length}). Maximum allowed is ${IMPORT_LIMITS.maxColumns}.`);
    }
    for (const row of rows) {
      if (!Array.isArray(row)) throw new Error('Invalid import payload — each row must be an array of cells.');
      if (row.some((cell) => String(cell ?? '').length > IMPORT_LIMITS.maxCellLength)) {
        throw new Error(`A cell exceeds the ${IMPORT_LIMITS.maxCellLength} character limit.`);
      }
    }

    const colIndex = new Map(columns.map((c, i) => [c, i]));

    const cell = (row: string[], field: keyof ImportMapping) => {
      const header = mapping[field];
      if (!header) return undefined;
      const idx = colIndex.get(header);
      return idx === undefined ? undefined : row[idx] ?? '';
    };
    const num = (v: any) => {
      const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
      return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : undefined;
    };

    if (!mapping.name) throw new Error('Map the item name column before importing.');

    const created: number[] = [];
    const skipped: number[] = [];
    const notFound: number[] = [];
    const errors: { row: number; message: string }[] = [];

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < rows.length; i++) {
        const raw = rows[i];
        const name = String(cell(raw, 'name') ?? '').trim();
        const rowNo = i + 2; // 1-based data row (after header)
        if (!name) {
          errors.push({ row: rowNo, message: 'No item name in the mapped name column.' });
          continue;
        }

        const push = (kind: 'created' | 'skipped' | 'notFound') => {
          (kind === 'created' ? created : kind === 'skipped' ? skipped : notFound).push(rowNo);
        };

        if (target === 'MENU' || target === 'BAR' || target === 'POOL') {
          const price = num(cell(raw, 'price')) ?? num(defaults?.costPrice);
          const category = String(cell(raw, 'category') ?? defaults?.category ?? '').trim();
          if (!price || price <= 0) {
            errors.push({ row: rowNo, message: `Missing or invalid price for "${name}".` });
            continue;
          }
          const model = target === 'MENU' ? 'restaurantItem' : target === 'BAR' ? 'barItem' : 'poolService';
          const existing = await (tx as any)[model].findUnique({
            where: { name: { equals: name, mode: 'insensitive' } as any },
            select: { id: true },
          });
          if (existing) {
            push('skipped');
            continue;
          }
          await (tx as any)[model].create({
            data: {
              name,
              category: category || 'OTHERS',
              description: String(cell(raw, 'description') ?? '').trim() || null,
              price,
            },
          });
          push('created');
        }

        if (target === 'INVENTORY' || target === 'STOCK') {
          const sku = String(cell(raw, 'sku') ?? '').trim();
          const existing = await tx.inventoryItem.findFirst({
            where: {
              OR: [
                ...(sku ? [{ sku: { equals: sku, mode: 'insensitive' as const } }] : []),
                { name: { equals: name, mode: 'insensitive' } },
              ],
            },
            select: { id: true },
          });

          if (target === 'STOCK') {
            const quantity = num(cell(raw, 'quantity')) ?? num(defaults?.quantity);
            if (!existing) {
              if (quantity === undefined) {
                errors.push({ row: rowNo, message: `Stock row for "${name}" has no quantity.` });
              } else {
                notFound.push(rowNo);
              }
              continue;
            }
            const costPrice = num(cell(raw, 'costPrice')) ?? num(defaults?.costPrice);
            await tx.inventoryItem.update({
              where: { id: existing.id },
              data: {
                ...(quantity !== undefined ? { quantity } : {}),
                ...(costPrice !== undefined ? { costPrice } : {}),
              },
            });
            push('created');
            continue;
          }

          if (existing) {
            push('skipped');
            continue;
          }
          const quantity = num(cell(raw, 'quantity')) ?? num(defaults?.quantity) ?? 0;
          const minQuantity = num(cell(raw, 'minQuantity')) ?? num(defaults?.minQuantity) ?? 0;
          const costPrice = num(cell(raw, 'costPrice')) ?? num(defaults?.costPrice);
          await tx.inventoryItem.create({
            data: {
              sku: sku || `IMP-${String(name).toUpperCase().replace(/[^A-Z0-9]/g, '')}-${rowNo}`,
              name,
              category: String(cell(raw, 'category') ?? defaults?.category ?? '').trim() || 'RESTAURANT',
              unit: String(cell(raw, 'unit') ?? defaults?.unit ?? '').trim() || 'pcs',
              quantity,
              minQuantity,
              costPrice: costPrice ?? null,
              notes: String(cell(raw, 'notes') ?? '').trim() || null,
              createdBy,
            },
          });
          push('created');
        }
      }
    });

    return {
      target,
      created: created.length,
      skipped: skipped.length,
      notFound: notFound.length,
      errorCount: errors.length,
      errors,
    };
  }
}
