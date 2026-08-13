import { describe, expect, it } from 'vitest';
import { ImportService } from '../src/services/imports.service';

describe('import document parser', () => {
  it('detects a comma delimiter and trims cells', () => {
    const { columns, rows } = ImportService.parse('Name, Category, Price\nStar Lager, BEERS, 15\nCastle Milk Stout, BEERS, 18\n', 'csv');
    expect(columns).toEqual(['Name', 'Category', 'Price']);
    expect(rows).toEqual([
      ['Star Lager', 'BEERS', '15'],
      ['Castle Milk Stout', 'BEERS', '18'],
    ]);
  });

  it('honours quoted CSV fields that contain the delimiter', () => {
    const { rows } = ImportService.parse('name,desc\nFoo,"a, tricky value"\n');
    expect(rows).toEqual([['Foo', 'a, tricky value']]);
  });

  it('uses tabs for tsv input and falls back for other formats', () => {
    const tsv = ImportService.parse('name\tprice\nCocktail\t20\n', 'tsv');
    expect(tsv.columns).toEqual(['name', 'price']);
    expect(tsv.rows).toEqual([['Cocktail', '20']]);

    const semicolon = ImportService.parse('name;price\nWine;30\n', 'text');
    expect(semicolon.rows).toEqual([['Wine', '30']]);
  });

  it('parses whitespace-delimited document text from PDFs and Word exports', () => {
    const extracted = [
      'Name                    Category                  Price',
      'Star Lager              BEERS                     15',
      'Castle Milk Stout       BEERS                     18',
    ].join('\n');

    const parsed = ImportService.parse(extracted, 'pdf');
    expect(parsed.columns).toEqual(['Name', 'Category', 'Price']);
    expect(parsed.rows).toEqual([
      ['Star Lager', 'BEERS', '15'],
      ['Castle Milk Stout', 'BEERS', '18'],
    ]);
  });

  it('auto-detects tables across real document exports and unknown formats', () => {
    const autoCsv = ImportService.parse('name;price\nStar Lager;15\n', 'auto');
    expect(autoCsv.columns).toEqual(['name', 'price']);
    expect(autoCsv.rows).toEqual([['Star Lager', '15']]);

    const autoWhitespace = ImportService.parse(
      'Name                    Category                  Price\nStar Lager              BEERS                     15\nCastle Milk Stout       BEERS                     18\n',
      'auto',
    );
    expect(autoWhitespace.columns).toEqual(['Name', 'Category', 'Price']);
    expect(autoWhitespace.rows).toEqual([
      ['Star Lager', 'BEERS', '15'],
      ['Castle Milk Stout', 'BEERS', '18'],
    ]);
  });

  it('rejects empty or header-only documents', () => {
    expect(() => ImportService.parse('   ', 'csv')).toThrow(/empty/);
    expect(ImportService.parse('Name, Price\n\n', 'csv').rows).toEqual([]);
  });
});
