# Skill: Sync Memory Automation

## Description
Provides instructions and execution workflows for maintaining synchronization between `.agents/memory/` files (`long_term_memory.md` & `short_term_memory.md`), codebase changes, and development phases.

---

## Trigger Rules
Execute memory synchronization:
1. **At Session Start:** Read both `long_term_memory.md` and `short_term_memory.md` to load full state context.
2. **After Major Milestones:** When a feature or bug fix is finished and tested.
3. **Before Phase Transitions:** Trigger the Phase Transition Safety Protocol verification.
4. **At Session End:** Flush current session progress into `short_term_memory.md`.

---

## Execution Checklist

```markdown
1. READ:
   - Check current git status (`git status`, `git diff --stat`).
   - Read `.agents/memory/short_term_memory.md`.

2. EVALUATE:
   - Compare completed work against Active Task Checklist.
   - Check if new architectural decisions were made (Requires LTM update).

3. UPDATE SHORT-TERM MEMORY:
   - Mark completed items `[x]`.
   - Add new discovered tasks to checklist.
   - Update Scratchpad with relevant debug commands or state context.

4. UPDATE LONG-TERM MEMORY (If Applicable):
   - Record new ADRs (Architecture Decision Records).
   - Document schema changes or core API route additions.

5. VERIFY & CONFIRM:
   - Ensure markdown formatting is clean and structural headers remain intact.
```
