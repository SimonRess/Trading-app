Review the current working diff (staged and unstaged changes) against the project conventions defined in CLAUDE.md.

Check for violations of:
1. **Architecture boundaries** — does any file in src/game/ import from src/ui/ or src/render/?
2. **State mutation** — are state objects mutated in place instead of returning new state?
3. **TypeScript** — any use of `any` type?
4. **Exports** — any `export default`?
5. **File naming** — are new files in kebab-case?
6. **Comments** — are there comments that explain WHAT code does rather than WHY?
7. **Test coverage** — do new game logic files in src/game/ have a co-located .test.ts file?
8. **Doc conventions** — do any new docs/ files follow the templates in docs/00_project_structure.md?

Report findings as a numbered list grouped by category. For each violation, give the file path and line number. If no violations are found, say so explicitly.

Do not auto-fix — report only. The developer decides what to change.
