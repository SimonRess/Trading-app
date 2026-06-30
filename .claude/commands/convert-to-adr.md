Convert the existing decision document $ARGUMENTS into a properly formatted ADR.

The existing docs/01_platform.md through docs/09_recommended_stack.md were written before the ADR format was established. This command migrates one of them.

Steps:
1. Read the file specified in $ARGUMENTS.
2. Extract: the decision topic, the chosen option, the alternatives that were considered, and the stated pros/cons.
3. Determine the ADR number from the filename (e.g. docs/01_platform.md → ADR-001).
4. Create docs/decisions/adr-NNN-<slug>.md with Status "Accepted" and today's date, mapping the existing content into the standard ADR template:
   - Context: why the decision was needed
   - Decision: what was chosen
   - Alternatives Considered: each option listed with pros/cons converted to a brief note
   - Consequences: derive ✅ gains and ⚠️ trade-offs from the existing pros/cons
   - Links: cross-reference other ADRs in the same number range
5. Do NOT delete the original file yet — note at the top of the new ADR: "Migrated from docs/<original-filename>.md".
6. Add a row to the Decision Status Tracker in docs/00_project_structure.md if not already present.
7. Report the new file path.
