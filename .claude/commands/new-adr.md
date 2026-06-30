Create a new Architecture Decision Record (ADR) for the following decision: $ARGUMENTS

Steps:
1. List all files in docs/decisions/ to find the highest existing ADR number.
2. Increment it by 1 to get the new number NNN (zero-padded to 3 digits).
3. Convert the decision topic from $ARGUMENTS into a kebab-case slug (e.g. "market price formula" → "market-price-formula").
4. Create the file docs/decisions/adr-NNN-<slug>.md using exactly this template:

```
# ADR-NNN: <Title from $ARGUMENTS>

**Date:** <today's date as YYYY-MM-DD>
**Status:** Proposed
**Deciders:** Simon

## Context
<!-- What problem or question forced this decision? What constraints existed? -->

## Decision
<!-- What was decided, stated plainly in one or two sentences. -->

## Alternatives Considered
- **Option A** — pros / cons
- **Option B** — pros / cons

## Consequences
✅ 
⚠️  
🔒 

## Links
- Supersedes: —
- Superseded by: —
- Related ADRs: —
- Related design docs: —
```

5. Add a row for this ADR to the Decision Status Tracker table in docs/00_project_structure.md with Status "Proposed".
6. Report the file path created and remind the user to fill in Context, Alternatives Considered, and Consequences.
