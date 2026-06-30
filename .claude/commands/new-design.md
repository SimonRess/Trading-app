Create a new design document for the following system: $ARGUMENTS

Steps:
1. Convert the system name from $ARGUMENTS into a kebab-case filename (e.g. "Market Formula" → "market-formula.md").
2. Create the file docs/design/<filename>.md using exactly this template:

```
# Design: <System Name from $ARGUMENTS>

**Status:** Draft  
**Last updated:** <today's date as YYYY-MM-DD>

## Purpose
<!-- One paragraph: what this system does and why it exists in the game. -->

## Inputs & Outputs
<!-- What game state does this system read? What state does it produce or modify? -->

## Data Model
<!-- Key TypeScript interfaces or types, with field names. -->

## Core Logic
<!-- Step-by-step description of how the system works. Use numbered steps, formulas, or tables as appropriate. -->

## Edge Cases
<!-- What happens in unusual or boundary situations? -->

## Open Questions
<!-- Unresolved decisions that block or affect implementation. Remove entries when resolved. -->

## Related
<!-- ADR-NNN links and other design docs this system depends on or affects. -->
```

3. Search docs/decisions/ for ADR titles that are relevant to this system and pre-fill the Related section with matching ADR numbers and titles.
4. Add a row for this design doc to the Design Doc Status Tracker table in docs/00_project_structure.md with Status "Draft".
5. Report the file path created.
