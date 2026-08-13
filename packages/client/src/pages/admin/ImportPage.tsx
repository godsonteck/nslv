import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { importsApi, IMPORT_TARGETS } from '../../services/apiService';
import { useAuthStore } from '../../stores/authStore';
import { UploadCloud, FileSpreadsheet, Wand2, CheckCircle2, XCircle, RotateCcw, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button, FormField, TextInput, SelectInput, showToast } from '../../components/ui';
import { ShellPage, Section } from '../../components/common/WorkspaceUI';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const detectDocumentKind = (file: File, mime: string, ext: string): 'excel' | 'pdf' | 'docx' | 'doc' | 'csv' | 'tsv' | 'text' | null => {
  const lowerMime = mime.toLowerCase();
  const knownExcelTypes = [
    'application/vnd.ms-excel',
    'application/vnd.ms-excel.sheet.macroenabled.12',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    'application/xls',
    'application/xlsx',
    'application/octet-stream',
  ];
  const knownWordTypes = [
    'application/msword',
    'application/vnd.ms-word',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  ];

  if (['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'tsv'].includes(ext)) {
    return ext === 'tsv' ? 'tsv' : 'excel';
  }

  if (lowerMime.includes('sheet') || lowerMime.includes('excel') || knownExcelTypes.includes(lowerMime)) {
    return 'excel';
  }

  if (lowerMime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (knownWordTypes.includes(lowerMime) || ext === 'doc' || ext === 'docx' || ext === 'rtf') return ext === 'doc' ? 'doc' : 'docx';
  if (['txt', 'log'].includes(ext) || lowerMime.includes('text')) return 'text';

  return null;
};

const extractDocumentText = async (file: File): Promise<{ text: string; format: 'csv' | 'tsv' | 'text' | 'pdf' | 'doc' | 'docx' }> => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mime = file.type.toLowerCase();
  const kind = detectDocumentKind(file, mime, ext) ?? 'text';

  if (kind === 'excel') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    if (!sheet) return { text: '', format: 'csv' };
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ',', RS: '\n', blankrows: false });
    return { text: csv || '', format: 'csv' };
  }

  if (kind === 'pdf') {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
    const pages: string[] = [];
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageText) pages.push(pageText);
    }
    return { text: pages.join('\n'), format: 'pdf' };
  }

  if (kind === 'docx' || kind === 'doc') {
    const buffer = await file.arrayBuffer();
    if (kind === 'docx' || ext === 'docx' || mime.includes('wordprocessingml')) {
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      return { text: result.value || '', format: 'docx' };
    }
    return {
      text: new TextDecoder('windows-1252').decode(new Uint8Array(buffer)).replace(/\0/g, '').replace(/\s+/g, ' '),
      format: 'text',
    };
  }

  if (kind === 'tsv') return { text: await file.text(), format: 'tsv' };
  if (kind === 'csv') return { text: await file.text(), format: 'csv' };

  return { text: await file.text(), format: 'text' };
};

const TARGET_PERMISSION: Record<string, string> = {
  MENU: 'restaurant.menu',
  BAR: 'bar.menu',
  POOL: 'pool.manage',
  INVENTORY: 'inventory.manage',
  STOCK: 'inventory.adjust',
};

const normalize = (s: string) => s.toLowerCase().replace(/[\s_\-./'():]+/g, '');

const AUTOMAP_RULES: Array<{ field: string; patterns: RegExp[] }> = [
  { field: 'name', patterns: [/^name$/, /itemname/, /productname/, /^nameofthe/, /item/, /product/, /drink/, /service/] },
  { field: 'price', patterns: [/price/, /unitprice/, /^rate$/, /amount/, /ghs|gh₵/, /cost/] },
  { field: 'sku', patterns: [/^sku$/, /itemcode/, /^code$/, /reference/, /stockcode/] },
  { field: 'quantity', patterns: [/qty/, /quantity/, /onhand/, /^stock$/, /^count$/] },
  { field: 'minQuantity', patterns: [/min/, /reorder/, /threshold/] },
  { field: 'costPrice', patterns: [/costprice/, /unitcost/, /^cost$/] },
  { field: 'category', patterns: [/category/, /^type$/, /^group$/, /^section$/, /department/] },
  { field: 'description', patterns: [/description/, /^desc$/, /details/] },
  { field: 'unit', patterns: [/^unit$/, /uom/, /measure/] },
  { field: 'notes', patterns: [/^notes$/, /remark/, /comment/] },
];

const autoMap = (columns: string[]): Record<string, string> => {
  const mapping: Record<string, string> = {};
  const safeColumns = Array.isArray(columns) ? columns.filter((col) => typeof col === 'string' && col.trim().length > 0) : [];
  for (const col of safeColumns) {
    const key = normalize(col);
    for (const rule of AUTOMAP_RULES) {
      if (rule.patterns.some((p) => p.test(key))) {
        if (!mapping[rule.field]) {
          mapping[rule.field] = col;
          break;
        }
      }
    }
  }
  return mapping;
};

export const ImportPage: React.FC = () => {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [target, setTarget] = useState<string>('BAR');
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<{ columns: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const meta = IMPORT_TARGETS[target];
  const targetAllowed = hasPermission(TARGET_PERMISSION[target] as any);
  const availableTargets = Object.entries(IMPORT_TARGETS).filter(([key]) => hasPermission(TARGET_PERMISSION[key] as any));

  const reset = () => {
    setInputText('');
    setFileName('');
    setParsed(null);
    setMapping({});
    setDefaults({});
    setResult(null);
  };

  const handleFile = async (file: File) => {
    try {
      const extracted = await extractDocumentText(file);
      setInputText(extracted.text);
      setFileName(file.name);
      setResult(null);
      setParsed(null);
      showToast('success', `Read ${file.name} as ${extracted.format.toUpperCase()} text and ready to parse.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read the uploaded document.';
      showToast('error', `Could not extract text from ${file.name}: ${message}`);
    }
  };

  const parse = async () => {
    if (!inputText.trim()) {
      showToast('error', 'Paste a table or upload a CSV/Excel-export file first.');
      return;
    }
    try {
      setParsing(true);
      const ext = fileName.split('.').pop()?.toLowerCase();
      const format =
        ext === 'tsv' ? 'tsv' :
        ext === 'csv' ? 'csv' :
        ext === 'xls' || ext === 'xlsx' ? 'csv' :
        ext === 'pdf' ? 'pdf' :
        ext === 'doc' ? 'doc' :
        ext === 'docx' ? 'docx' :
        'text';
      const res = await importsApi.parse(inputText, format as any);
      const p = res?.data;
      if (!p || !Array.isArray(p.columns) || !Array.isArray(p.rows)) {
        throw new Error('This document does not contain a readable table. Please upload a PDF, Word, Excel, CSV, or another tabular file with clear column headers.');
      }
      const safeColumns = p.columns.filter((col: unknown) => typeof col === 'string' && col.trim().length > 0);
      if (safeColumns.length === 0) {
        throw new Error('No usable column headers were detected. Please check that the document includes a proper table header row.');
      }
      const safeRows = p.rows
        .map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : []))
        .filter((row) => row.some((cell) => cell.trim().length > 0));
      if (safeRows.length === 0) {
        throw new Error('The document contains no data rows after the header. Please add at least one row with values.');
      }
      setParsed({ columns: safeColumns, rows: safeRows });
      setMapping(autoMap(safeColumns));
      setDefaults({});
      setResult(null);
      showToast('success', `Parsed ${safeRows.length} rows and ${safeColumns.length} columns.`);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to parse the document');
    } finally {
      setParsing(false);
    }
  };

  const runImport = async () => {
    if (!parsed) return;
    try {
      setRunning(true);
      const res = await importsApi.run({
        target,
        columns: parsed.columns,
        rows: parsed.rows,
        mapping,
        defaults,
      });
      setResult(res.data);
      showToast('success', `Import complete — ${res.data.created} created, ${res.data.skipped} skipped, ${res.data.errorCount} errors.`);
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Unable to run the import');
    } finally {
      setRunning(false);
    }
  };

  const preview = useMemo(() => parsed?.rows.slice(0, 8) ?? [], [parsed]);

  return (
    <ShellPage
      eyebrow="ADMIN · DATA IMPORT"
      title="Import documents"
      subtitle="Upload or paste a table and auto-fill your menu, bar, pool, inventory and stock records."
      actions={
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw size={14} /> Start over
        </Button>
      }
    >
      <Section title="1 · Choose what you are importing" subtitle="Existing items are skipped automatically — new ones are added.">
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
          {availableTargets.map(([key, m]) => (
            <button
              key={key}
              onClick={() => {
                setTarget(key);
                setResult(null);
              }}
              className={`rounded-2xl border p-4 text-left transition ${target === key ? 'border-[#174b59] bg-[#eef3f0]' : 'border-[#e7ebe8] bg-white hover:border-[#cfd8d3]'}`}
            >
              <div className="text-sm font-extrabold text-[#20343e]">{m.label}</div>
              <p className="mt-1 text-[10px] leading-4 text-[#8a9598]">{m.description}</p>
            </button>
          ))}
        </div>
        {!targetAllowed && (
          <div className="mx-5 mb-5 flex items-center gap-2 rounded-xl bg-[#f3e3c3] px-3 py-2 text-[11px] font-semibold text-[#8a6d1f]">
            <AlertTriangle size={14} /> You don't have permission to import into this target.
          </div>
        )}
      </Section>

      <Section title="2 · Paste your table or upload a file" subtitle="CSV, Excel-export or copy-pasted table. Tip: if the source is a PDF, copy the table from it and paste it here.">
        <div className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[#cfd8d3] bg-white px-4 py-3 text-[11px] font-extrabold text-[#174b59] transition hover:border-[#174b59]">
              <UploadCloud size={15} />
              {fileName || 'Choose a PDF / Word / CSV / Excel / text file'}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.xlsb,.csv,.tsv,.txt,.rtf,text/csv,text/plain,application/pdf,application/msword,application/vnd.ms-excel,application/vnd.ms-excel.sheet.macroenabled.12,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.wordprocessingml.template"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    void handleFile(f);
                  }
                }}
              />
            </label>
            {fileName && <span className="text-[10px] text-[#8a9598]">{fileName}</span>}
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={8}
            placeholder={'Item Name, Category, Price\nStar Lager, BEERS, 15\nCastle Milk Stout, BEERS, 18\n…'}
            className="w-full rounded-2xl border border-[#e7ebe8] bg-[#fbfcfa] p-3 font-mono text-[11px] leading-5 text-[#26363e] outline-none focus:border-[#174b59]"
          />
          <div className="text-[10px] text-[#8a9598]">Supported formats: PDF, DOCX, DOC, CSV, TSV, TXT and pasted tables.</div>
          <div className="flex justify-end">
            <Button onClick={() => void parse()} loading={parsing}>
              <Wand2 size={14} /> Parse document
            </Button>
          </div>
        </div>
      </Section>

      {parsed && (
        <Section
          title="3 · Map columns"
          subtitle="Tell the system which document column matches each field. Unmapped optional fields are left blank."
          action={
            <Button size="sm" onClick={() => void runImport()} loading={running} disabled={!targetAllowed || running}>
              <ArrowRight size={14} /> Import {parsed.rows.length} rows
            </Button>
          }
        >
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#e7ebe8] bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-[#20343e]">
                <FileSpreadsheet size={14} /> Column mapping
              </div>
              <div className="space-y-3">
                {meta.fields.map((f) => (
                  <div key={f.key} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                    <FormField label={`${f.label}${f.required ? ' *' : ''}`}>
                      <SelectInput
                        value={mapping[f.key] ?? ''}
                        onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                      >
                        <option value="">— Not mapped —</option>
                        {parsed.columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </SelectInput>
                    </FormField>
                    <div className="text-[10px] text-[#8a9598]">
                      {f.required && !mapping[f.key] && <span className="font-bold text-[#b23a3a]">Required before importing.</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-[#e7ebe8] bg-white p-4">
              <div className="mb-3 text-[11px] font-extrabold uppercase tracking-wide text-[#20343e]">Defaults (applied to every row)</div>
              <div className="space-y-3">
                {meta.defaults.map((d) => (
                  <FormField key={d.key} label={d.label}>
                    {d.options ? (
                      <SelectInput value={defaults[d.key] ?? ''} onChange={(e) => setDefaults((x) => ({ ...x, [d.key]: e.target.value }))}>
                        <option value="">Use value from column</option>
                        {d.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </SelectInput>
                    ) : (
                      <TextInput value={defaults[d.key] ?? ''} onChange={(e) => setDefaults((x) => ({ ...x, [d.key]: e.target.value }))} placeholder={d.placeholder} />
                    )}
                  </FormField>
                ))}
                <p className="text-[10px] leading-4 text-[#8a9598]">
                  Categories & units that appear in every row can be set here instead of mapping a column. Existing records with the same name are skipped, never overwritten.
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-[#eef1ee] px-5 py-4">
            <div className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-[#8a9598]">Preview — first {preview.length} of {parsed.rows.length} rows</div>
            <div className="overflow-x-auto rounded-xl border border-[#eef1ee]">
              <table className="w-full text-left">
                <thead className="bg-[#f7f8f6] text-[10px] uppercase tracking-[.1em] text-[#7d898d]">
                  <tr>
                    {parsed.columns.map((c) => (
                      <th key={c} className="px-3 py-2">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf0ed] text-[11px] text-[#26363e]">
                  {preview.map((r, i) => (
                    <tr key={i}>
                      {r.map((cell, j) => (
                        <td key={j} className="px-3 py-2">{cell || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      )}

      {result && (
        <Section title="Import result" subtitle={`Target: ${IMPORT_TARGETS[result.target]?.label ?? result.target}`}>
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-[#dce8e2] bg-[#f0f7f3] p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#1f6f4a]">
                  <CheckCircle2 size={14} /> Created
                </div>
                <div className="mt-1 text-2xl font-extrabold text-[#1f6f4a]">{result.created}</div>
              </div>
              <div className="rounded-2xl border border-[#e5e0d3] bg-[#faf7f0] p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#8a6d1f]">Skipped (already exist)</div>
                <div className="mt-1 text-2xl font-extrabold text-[#8a6d1f]">{result.skipped}</div>
              </div>
              <div className="rounded-2xl border border-[#e4dcd8] bg-[#faf5f2] p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#b0553a]">Not found (stock only)</div>
                <div className="mt-1 text-2xl font-extrabold text-[#b0553a]">{result.notFound}</div>
              </div>
              <div className="rounded-2xl border border-[#f0e0de] bg-[#fcf3f2] p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#b23a3a]">
                  <XCircle size={14} /> Row errors
                </div>
                <div className="mt-1 text-2xl font-extrabold text-[#b23a3a]">{result.errorCount}</div>
              </div>
            </div>
            {result.errors?.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-xl border border-[#f0e0de]">
                <table className="w-full text-left">
                  <thead className="bg-[#fcf3f2] text-[10px] uppercase tracking-[.1em] text-[#b23a3a]">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Problem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f6e4e2] text-[11px] text-[#26363e]">
                    {result.errors.map((e: any, i: number) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono">{e.row}</td>
                        <td className="px-3 py-2">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw size={13} /> Import another document
              </Button>
            </div>
          </div>
        </Section>
      )}
    </ShellPage>
  );
};

export default ImportPage;
