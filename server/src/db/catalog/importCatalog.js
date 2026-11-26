// Imports the SCIT academic catalog (src/db/catalog/scit-catalog.json, which
// was transcribed from the PDF diet sheets) into the database.
//
// The import is safe to run repeatedly ("upsert"): it creates missing rows and
// updates existing ones, matched by school code, programme name + major and
// module code. It never deletes anything, so data an administrator added in
// the admin screens is kept.
//
// Usage: npm run db:import-catalog            (import into DATABASE_URL)
//        npm run db:import-catalog -- --check (validate the JSON only)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const CATALOG_PATH = path.join(here, 'scit-catalog.json');

const SLOT = { 1: 'SEM1', 2: 'SEM2', YEAR: 'YEAR', EITHER: 'EITHER' };

export function loadCatalog(file = CATALOG_PATH) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Turn the JSON into plain lists of modules and programme-module rows,
 * applying the documented overrides. Throws if the sheets disagree about a
 * module's credits and no override settles it.
 */
export function resolveCatalog(catalog) {
  const overrides = catalog.moduleOverrides ?? {};
  const sightings = new Map(); // code -> [{ name, credits }]
  const programs = [];

  for (const program of catalog.programs) {
    // The programme's own rows first, then shared sets in the order listed.
    // If a module appears twice, the first appearance wins (core before elective).
    const rows = [...program.modules];
    for (const setName of program.include ?? []) {
      const set = catalog.moduleSets[setName];
      if (!set) throw new Error(`Programme "${program.name} ${program.major}" includes unknown set "${setName}"`);
      rows.push(...set.modules);
    }

    const byCode = new Map();
    for (const [code, name, credits, level, slot, choiceGroup] of rows) {
      if (!SLOT[slot]) throw new Error(`Module ${code}: unknown semester slot "${slot}"`);
      const list = sightings.get(code) ?? [];
      list.push({ name, credits });
      sightings.set(code, list);
      if (!byCode.has(code))
        byCode.set(code, { code, level, semesterSlot: SLOT[slot], choiceGroup: choiceGroup ?? null });
    }
    programs.push({
      name: program.name,
      major: program.major ?? null,
      source: program.source,
      modules: [...byCode.values()],
    });
  }

  const modules = [];
  const problems = [];
  for (const [code, seen] of sightings) {
    const override = overrides[code] ?? {};

    // Name: explicit override, otherwise the most common spelling (ties -> first seen).
    const counts = new Map();
    for (const s of seen) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
    const commonName = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    // Credits: override, otherwise all sheets that list credits must agree.
    const creditValues = [...new Set(seen.map((s) => s.credits).filter((c) => c !== null && c !== undefined))];
    if (override.credits === undefined && creditValues.length > 1) {
      problems.push(
        `${code}: diet sheets disagree on credits (${creditValues.join(' vs ')}) - add a moduleOverrides entry`,
      );
    }

    modules.push({
      code,
      name: override.name ?? commonName,
      credits: override.credits ?? creditValues[0] ?? null,
    });
  }
  if (problems.length) throw new Error(`Catalog has unresolved conflicts:\n  ${problems.join('\n  ')}`);

  modules.sort((a, b) => a.code.localeCompare(b.code));
  return { school: catalog.school, modules, programs };
}

/** Upsert the resolved catalog using the given Prisma client. */
export async function importCatalog(prisma, catalog = loadCatalog(), { log = console.log } = {}) {
  const resolved = resolveCatalog(catalog);

  return prisma.$transaction(
    async (tx) => {
      const school = await tx.school.upsert({
        where: { code: resolved.school.code },
        update: { name: resolved.school.name },
        create: resolved.school,
      });

      const moduleIds = new Map();
      for (const m of resolved.modules) {
        const row = await tx.module.upsert({
          where: { code: m.code },
          update: { name: m.name, credits: m.credits },
          create: m,
        });
        moduleIds.set(m.code, row.id);
      }

      let links = 0;
      for (const p of resolved.programs) {
        let program = await tx.program.findFirst({ where: { schoolId: school.id, name: p.name, major: p.major } });
        program ??= await tx.program.create({ data: { schoolId: school.id, name: p.name, major: p.major } });

        for (const pm of p.modules) {
          const moduleId = moduleIds.get(pm.code);
          const data = { level: pm.level, semesterSlot: pm.semesterSlot, choiceGroup: pm.choiceGroup };
          await tx.programModule.upsert({
            where: { programId_moduleId: { programId: program.id, moduleId } },
            update: data,
            create: { programId: program.id, moduleId, ...data },
          });
          links += 1;
        }
      }

      const summary = {
        school: school.code,
        programs: resolved.programs.length,
        modules: resolved.modules.length,
        programModules: links,
      };
      log(
        `Catalog imported: ${summary.programs} programmes, ${summary.modules} modules, ${summary.programModules} programme-module links.`,
      );
      return summary;
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}

// Run directly: node src/db/catalog/importCatalog.js [--check]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = loadCatalog();
  if (process.argv.includes('--check')) {
    const r = resolveCatalog(catalog);
    console.log(`Catalog OK: ${r.programs.length} programmes, ${r.modules.length} modules.`);
    for (const p of r.programs)
      console.log(`  - ${p.name}${p.major ? ` – ${p.major}` : ''}: ${p.modules.length} modules`);
  } else {
    const { prisma, disconnectDatabase } = await import('../client.js');
    try {
      await importCatalog(prisma, catalog);
    } finally {
      await disconnectDatabase();
    }
  }
}
