# AI Repo Governance
<!-- managed-by: dev-harness-core -->

## Core Operating Rules
1. Never work directly on `main` or `master`.
2. Before making changes, inspect the current branch and `git status`.
3. If the repo is not already on a task branch, propose a branch name before coding.
4. If the repository uses an external tracker such as Linear, read the active issue before coding and sync its state when work starts, moves to review, or closes.
5. One branch per task.
6. Do not start duplicate implementation work for an issue already claimed on another active branch or AI lane.
7. Do not approve code you authored yourself; route review to a different AI lane.
8. One logical change per commit.
9. Do not make broad refactors unless explicitly requested.
10. Do not modify unrelated files.
11. Review `git diff` before recommending a commit.
12. Do not commit secrets, tokens, credentials, `.env` files, or machine-specific settings.
13. If the working tree already contains unrelated changes, stop and identify them before editing.
14. If the task grows beyond one commit-sized change, split it into milestones.
15. Prefer minimal, targeted edits over sweeping rewrites.
16. Add or update tests when relevant.
17. At the end of any task, provide changed files, a summary, a recommended commit message, and risks or follow-up items.

## Branch Naming
- `feature/<scope>`
- `fix/<scope>`
- `refactor/<scope>`
- `spike/<scope>`
- `chore/<scope>`
- `hotfix/<scope>`
- `crd/<scope>`

When an issue tracker key exists, prefer:
- `crd/<ISSUE>-<scope>`
- `fix/<ISSUE>-<scope>`

## Commit Rules
- Use imperative style.
- Keep commits scoped to one logical unit.
- Avoid vague messages such as `stuff`, `updates`, or `final`.

## Default Workflow
1. Check `git status`.
2. Confirm the current branch.
3. If the repo uses an external tracker such as Linear, read the active issue and confirm ownership before coding.
4. If needed, create a task branch.
5. Prefer a branch name that includes the issue key when one exists.
6. Summarize the scope before coding.
7. List expected files to change.
8. Make the smallest useful change.
9. Hand review to a different AI lane if the repository uses cross-AI review.
10. Review `git diff`.
11. Recommend a commit message that includes the issue key when one exists.
12. Stop after the milestone is complete.

## AI-Specific Rules
- AI-generated changes must be reviewed before commit.
- Do not allow unrelated repo-wide edits.
- Do not reformat the whole project unless explicitly asked.
- Do not change architecture outside the task.
- Stop and split the work if it becomes too large.
- These rules apply to direct assistants and orchestration wrappers such as `omx`, `omc`, child agents, and team commands.

## Reviewer Handoff (Linear-first)

When implementation is complete, hand off to a reviewer AI in a different lane.

**Step-by-step example** (author AI = Claude, reviewer AI = Codex):

```
1. Push the task branch:
   git push -u origin crd/VIS-42-add-auth

2. Move the Linear issue: In Progress → In Review

3. Switch AI-lane label: Claude → Codex

4. Leave a Linear comment:
   "Implementation complete on crd/VIS-42-add-auth.
    Changed: apps/auth/login.ts, apps/auth/session.ts
    Summary: Added JWT refresh flow with 15-min expiry."

5. Stop — do not self-approve or merge.
```

**Reviewer AI (Codex) picks it up and:**
1. Checks out the branch, reads `git diff main...HEAD`.
2. Runs `harness lint-stack <repo>` and any relevant tests.
3. Leaves review findings as a Linear comment.
4. **Approved** → moves issue to `Done`, merges the branch.
5. **Changes needed** → moves issue back to `In Progress`, switches label back to `Claude`, comments with required fixes.

**Key rules:**
- The author AI and reviewer AI must be different.
- Only the reviewer AI may approve and merge.
- The AI-lane label on the Linear issue always reflects who should act next.

## Recovery Rule
If the repo is already messy:
1. Do not continue coding blindly.
2. Identify change groups.
3. Separate likely features, fixes, and accidental edits.
4. Propose a recovery sequence before more changes.
