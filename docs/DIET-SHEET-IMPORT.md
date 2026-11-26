# SCIT Diet Sheet Import

All programme and module information in the system comes from the 22 PDF diet sheets / module selection guides in [`docs/SCIT-DIET-SHEETS`](SCIT-DIET-SHEETS). This document records how they were turned into catalog data, which sheets were used, and every place where the sheets disagreed or needed interpretation. Nothing was invented: where a sheet was silent, the value was left empty or the decision is listed below for an administrator to confirm.

## Approach

1. **Read every sheet.** Text-based PDFs were extracted with `pdfjs-dist`; tables whose columns merged in the text layer, and image-only PDFs (Gaming, Applied AI), were read visually page by page.
2. **Transcribe into JSON.** The result is [`server/src/db/catalog/scit-catalog.json`](../server/src/db/catalog/scit-catalog.json). Each module row is `[code, name, credits, level, semesterSlot, choiceGroup?]`. Blocks shared between programmes (e.g. BSc Computing Years 1–2) are defined once as `moduleSets` and included by each programme.
3. **Resolve and validate.** [`importCatalog.js`](../server/src/db/catalog/importCatalog.js) merges the rows, stores each module code once, applies documented `moduleOverrides`, and **refuses to import** if two sheets give different credits for a module without an override.
4. **Import.** `npm run db:import-catalog` (also run by `npm run db:seed`) upserts the catalog - it adds and updates but never deletes, so changes made in the admin screens are kept.

This is the "administrator-reviewed import script" option from the project plan's open questions: the JSON file is human-readable and reviewable, and the admin screens can correct anything afterwards. See [OPEN-DECISIONS.md](OPEN-DECISIONS.md#3-diet-sheet-import-process).

### Mapping rules

| Diet sheet                                                                                                                                  | Catalog                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| "Level N" / "Year N"                                                                                                                        | `level = N`                                                                                      |
| "Semester 1" / "Semester 2"                                                                                                                 | slot `1` / `2`                                                                                   |
| Sequential "Semester 1…8" (Animation, Gaming, Applied AI)                                                                                   | Year = ⌈n/2⌉; odd → slot `1`, even → slot `2`                                                    |
| "Yearlong project" (PRJ4020)                                                                                                                | slot `YEAR` (applied wherever PRJ4020 appears)                                                   |
| "Can be completed in SEM1 or SEM2"; "Any six of these modules may be done in either semester" (CNS Year 1); elective pools with no semester | slot `EITHER`                                                                                    |
| "X **or** Y" rows                                                                                                                           | both modules, same `choiceGroup` (e.g. `ENS3001/MEE2003`)                                        |
| "SCIT Upper-Level Elective", "University Elective", `CITXXXX`, `UNXXXX`, `ELXXXX` placeholders                                              | not modules - not imported                                                                       |
| Elective tables                                                                                                                             | imported as modules of the programme at the level where the elective slots appear, slot `EITHER` |
| Prerequisites / co-requisites                                                                                                               | **not imported** (out of scope for v1)                                                           |
| Full-time vs part-time tracks (CIS Year 1)                                                                                                  | full-time track only                                                                             |

## Sources used

| Programme (name – major)                                                               | Sheet used                                                                                                                                                       | Superseded / cross-checked                                                                                                                                                                        |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BSc Computing – Computer Science                                                       | `Bsc Computing/BSc. Computing - Computer Science Major.pdf` (2023/2024, rev. May 2023)                                                                           | –                                                                                                                                                                                                 |
| BSc Computing – Information Technology                                                 | `Bsc Computing/BSc. Computing - IT major.pdf` (2024/2025, rev. July 2024) - covers the Enterprise Systems, Information Systems, Networking and Multimedia routes | The four 2023/2024 route sheets (`IT major Enterprise Systems (1)`, `Information Systems (1)`, `Networking`, `Multimedia`) - they differ only in prerequisites and an older Digital Graphics code |
| BSc Computer Networking and Security – Cyber Security                                  | `Bsc CNS/Student Planner - BSc CNS (Cyber Security)-2025 (3).pdf` (rev. 2025)                                                                                    | `BSc. CNS - Major Cybersecurity.pdf` (rev. July 2023) - same modules                                                                                                                              |
| BSc Computer Networking and Security – Infrastructure                                  | `Bsc CNS/Student Planner - BSc CNS (Infrastructure)-2025 (3).pdf` (rev. 2025)                                                                                    | `BSc. CNS - Major Infastructure.pdf.pdf` (rev. July 2023) - same modules                                                                                                                          |
| BSc Computer Information Systems – Data Analytics                                      | `Bsc CIS/BSc. CIS - Major Data Analytics.pdf` (2025/26 guide, 138 credits)                                                                                       | `B.Sc. Computer Information System_Major_ Data Analytics.pdf` (older 137-credit sheet; also listed CSP1010, HEA3003)                                                                              |
| BSc Computer Information Systems – Technology Entrepreneurship                         | `Bsc CIS/BSc. CIS - Major Tech Entrep.pdf`                                                                                                                       | `B.Sc. Computer Information System_Major_ Technology Entrepreneurship..pdf` (older; also listed CIS3031, CSP1010, HEA3003)                                                                        |
| BSc Computer Information Systems – Data Analytics (Minor: Technology Entrepreneurship) | `Bsc CIS/BSc. CIS - Major Data Analytics, Minor Tech Entrep.pdf`                                                                                                 | –                                                                                                                                                                                                 |
| BSc Computer Information Systems – Technology Entrepreneurship (Minor: Data Analytics) | `Bsc CIS/BSc. CIS - Major Tech Entrep, Minor Data Analytics.pdf`                                                                                                 | –                                                                                                                                                                                                 |
| BSc Gaming – Game Development                                                          | `Bsc Gaming/Bsc Gaming (Game Development) Selection Guide (2026)-4yrs.pdf` (rev. March 2026)                                                                     | `BSc. Gaming.pdf` (July 2023, Years 1–2 only, identical)                                                                                                                                          |
| BSc Gaming – Game Design                                                               | Years 1–2 from both Gaming sheets                                                                                                                                | **Years 3–4 are not on any supplied sheet** ("to be added")                                                                                                                                       |
| BSc Applied Artificial Intelligence                                                    | `Bsc Applied AI/BSc Applied AI Module Selection Guide (2026)-4yrs.pdf` (rev. March 2026)                                                                         | `BSc AAI.pdf` (July 2023, Years 1–2 only, identical)                                                                                                                                              |
| BSc Animation Development and Production                                               | `Bsc Animation/BSc. Animation.pdf` (starting AY 2023/24)                                                                                                         | –                                                                                                                                                                                                 |

Totals: **1 school (SCIT), 12 programmes, 183 modules, 654 programme-module links.**

## Reconciliation notes

### Same code, different credits (resolved with `moduleOverrides`)

| Module                                             | Sheets disagree | Value used | Reason                                                                                                 |
| -------------------------------------------------- | --------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| CIT3017 Network Administration & Technical Support | 4 vs 3          | 4          | 4 on the CNS 2025 and BSc Computing sheets where it is a core module; 3 only in the CIS elective table |
| CIT4024 IT Project Management                      | 3 vs 4          | 3          | 3 on CNS 2025, CIS 2025/26 and Animation; 4 on the older BSc Computing sheets                          |
| CNS2003 Virtualized Systems                        | 3 vs 4          | 3          | 3 on CNS 2025 and Gaming/AAI 2026; 4 only in the CIS elective table                                    |
| ENS3001 Environmental Studies                      | 3 vs 1          | 3          | 3 on Computing, CNS, CIS and Animation; Gaming/AAI 2026 show 1                                         |
| MAT1008 Discrete Mathematics                       | 3 vs 4          | 3          | 3 on CNS, CIS, Gaming and AAI (2025–2026); 4 on the older Computing sheets                             |

### Same code, different names

The import uses the most common spelling unless overridden. Explicit overrides:

| Module  | Chosen name                                    | Other spellings                                                                |
| ------- | ---------------------------------------------- | ------------------------------------------------------------------------------ |
| CIT3023 | Introduction to Human Computer Interaction     | "Intro Human Computer Interaction", "Introduction to Human Computer Interface" |
| CIT4004 | Design of Programming Languages (2026 AAI)     | "Analysis of Programming Languages" (2023 CS)                                  |
| CIT4010 | Enterprise Computing 2                         | "Enterprise Computing II"                                                      |
| CMP3040 | Computer Forensics (2025 CNS)                  | "Forensic Computing"                                                           |
| CNS1003 | Computing Practice 1 (CNS, its home programme) | "Computer Practice" (CIS)                                                      |
| ANI2004 | Storytelling for Animation I (Animation sheet) | "Story Telling for Animation" (Gaming)                                         |

Other variants (e.g. "&" vs "and", "Calculus 1" vs "Calculus I", "Computer Networks" vs "Computer Networks 1") resolve to the most common spelling automatically.

### Apparent misprints on the sheets

| Sheet                            | Printed                                                                                  | Used                                                | Evidence                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| CNS Cyber Security 2025 planner  | "CNS3001 Security Testing and Detection" (CNS3001 is already Cyber Security; no credits) | **CNS3003** Security Testing & Detection, 3 credits | The 2023 Cyber Security sheet lists it as CNS3003                                              |
| CIS 2025/26 guides, Year 1 Sem 2 | "Computer Networks (COM2016) OR Web Programming (CIT2011)"                               | **CMP1026** Computer Networks                       | COM2016 is Critical Thinking; the same guide's elective table lists CMP1026 Computer Networks  |
| Gaming 2026, Semester 6          | "ANI1002 Animation Tools II" (prerequisite ANI1002)                                      | **ANI1006** Animation Tools II                      | The Animation sheet lists ANI1002 = Animation Tools I, ANI1006 = Animation Tools II            |
| IT 2024/25 elective table        | "CIT4010 Introduction to Bioinformatics"                                                 | not imported as a separate entry                    | CIT4010 is Enterprise Computing 2 on the same sheet; Introduction to Bioinformatics is BIO3004 |

### Modules with no credits on the sheet (stored with `credits = NULL`)

- CIS external electives: ACC2009, ENT4010, EPI4001, FIN3001, FIN3011, HEA1019, HEA1035, ISD3011, LAW2001, LLB3001, MKT2004, STA3005 (ACC2001 and MKT3023 have credits from the Technology Entrepreneurship core).
- INE3011 Business Process Engineering (CIS Technology Entrepreneurship, Year 4 Sem 2 - no credits or prerequisite printed).
- Animation elective tables ("3 or 4" credits per slot): ANI3005–ANI3009, ANI3011, MKT3010, MKT4015, ACC1001 (others get credits from other sheets).

### Other interpretation decisions

- **Two Digital Graphics codes.** CIT4011 (2023 CS elective, "Computer Graphics" in CIS) and CIT3028 (2024 IT Multimedia route) are both kept, as printed.
- **PRJ4020 in programmes that list it under one semester only** (CNS, CIS, AAI: "0 credits in Semester 7, 3 in Semester 8") is stored as `YEAR` - the Computing sheets call it a "Yearlong project" and the project plan names it as the year-long example.
- **CNS Year 1** - "Any six (6) of these modules may be done in either semester", so all Year 1 CNS modules are `EITHER`.
- **One IT programme, not four.** The 2024/25 IT sheet is a single "Major: Information Technology" guide listing all four routes; each route's modules can be taken by other routes as electives, so all are offered to the one IT programme.
- **Game Design** has only Years 1–2 until SCIT publishes Years 3–4.

## Updating the catalog later

When new diet sheets arrive:

1. Edit `scit-catalog.json` (or add a new programme object), keeping the row format above.
2. Run `cd server && npm run db:check-catalog` - it reports credit conflicts that need an override.
3. Run `npm run db:import-catalog` against the target database.
4. Review the result in **Admin → Programmes & modules**, and fix individual rows there if needed.

Small changes (a renamed module, a new elective, a moved semester) can be made directly in the admin screens without touching the JSON.
