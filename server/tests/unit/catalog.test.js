// The diet-sheet catalog file and the rules it encodes.
import { describe, expect, it } from 'vitest';
import { loadCatalog, resolveCatalog } from '../../src/db/catalog/importCatalog.js';

const catalog = loadCatalog();
const resolved = resolveCatalog(catalog);
const program = (name, major = null) => resolved.programs.find((p) => p.name === name && p.major === major);
const row = (p, code) => p.modules.find((m) => m.code === code);

describe('SCIT catalog transcribed from the diet sheets', () => {
  it('contains every programme from docs/SCIT-DIET-SHEETS', () => {
    expect(resolved.programs).toHaveLength(12);
    expect(program('BSc Computing', 'Computer Science')).toBeDefined();
    expect(program('BSc Computing', 'Information Technology')).toBeDefined();
    expect(program('BSc Computer Networking and Security', 'Cyber Security')).toBeDefined();
    expect(program('BSc Computer Information Systems', 'Data Analytics')).toBeDefined();
    expect(program('BSc Gaming', 'Game Development')).toBeDefined();
    expect(program('BSc Applied Artificial Intelligence')).toBeDefined();
    expect(program('BSc Animation Development and Production')).toBeDefined();
  });

  it('stores each module once even when several programmes share it', () => {
    const codes = resolved.modules.map((m) => m.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('shares Year 1 and 2 modules between the Computer Science and IT majors', () => {
    const cs = program('BSc Computing', 'Computer Science');
    const it_ = program('BSc Computing', 'Information Technology');
    const years12 = (p) => p.modules.filter((m) => m.level <= 2).map((m) => m.code).sort();
    expect(years12(cs)).toEqual(years12(it_));
    expect(row(cs, 'CMP1024')).toMatchObject({ level: 1, semesterSlot: 'SEM1' });
  });

  it('marks PRJ4020 (Major Project) as year-long in every programme that has it', () => {
    const withProject = resolved.programs.filter((p) => row(p, 'PRJ4020'));
    expect(withProject.length).toBeGreaterThanOrEqual(10);
    for (const p of withProject) expect(row(p, 'PRJ4020').semesterSlot).toBe('YEAR');
  });

  it('records ENS3001 / MEE2003 as an either/or pair', () => {
    const cs = program('BSc Computing', 'Computer Science');
    expect(row(cs, 'ENS3001').choiceGroup).toBe('ENS3001/MEE2003');
    expect(row(cs, 'MEE2003').choiceGroup).toBe('ENS3001/MEE2003');
  });

  it('applies the documented overrides where diet sheets disagree', () => {
    const credits = (code) => resolved.modules.find((m) => m.code === code).credits;
    expect(credits('ENS3001')).toBe(3);
    expect(credits('CIT4024')).toBe(3);
  });

  it('refuses to import when sheets disagree on credits without an override', () => {
    const bad = structuredClone(catalog);
    delete bad.moduleOverrides.ENS3001;
    expect(() => resolveCatalog(bad)).toThrow(/ENS3001/);
  });
});
