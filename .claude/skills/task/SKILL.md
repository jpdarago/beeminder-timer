---
name: task
description: Work on a task from TASKS.md by number
disable-model-invocation: true
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, AskUserQuestion
argument-hint: [task-number]
---

# Work on a task from TASKS.md

## Setup

1. If `$ARGUMENTS` is empty or blank, open TASKS.md and check which tasks have been completed already but are not yet checked off. To determine completion, check merged PRs (`gh pr list --state merged`), closed issues (`gh issue list --state closed`), and inspect the codebase for implemented features. If any unchecked tasks are actually completed, tick them (`[x]`) in TASKS.md and create a commit saying you are marking already completed tasks.
1. If `$ARGUMENTS` is empty or blank, read `TASKS.md` and list all unchecked (`[ ]`) tasks with their numbers, then use `AskUserQuestion` to ask the user which task number to work on. Use that answer as the task number going forward.
1. Read `TASKS.md` and find the task matching the chosen task number.
1. Verify the task is not already checked off (`[x]`). If it is, tell the user and stop.
1. If the task description contains the word **"Design"**, follow the **Design Workflow** below instead of the normal Workflow.
1. Read the current git branch. If you are not on `main`, ask the user before proceeding.

In the steps below, **TASK_NUMBER** refers to `$ARGUMENTS` if provided, or the number chosen by the user in step 1.

## Design Workflow

If the task is a design task:

1. Look for `design/template.md` in the project root. If it exists, use it as the base structure for the design doc. If it does not exist, generate a design doc with whatever structure best fits the task (e.g., problem statement, proposed approach, alternatives considered, open questions).
2. Create the design doc at `design/TASK_NUMBER.md` (e.g., `design/5.md`).
3. Commit the design doc and tell the user it is ready for review. Then **stop and wait**. Do not proceed until the user has marked the design doc with `JP: LGTM` at the top of the file.
4. Once `JP: LGTM` is present, create a GitHub issue, feature branch, and PR following the same steps as the normal workflow (steps 1, 2, 5–8 below), but skip implementation and verification steps.

## Workflow

Follow the instructions at the top of `TASKS.md`. Specifically:

### 1. Create a GitHub issue

- Use `gh issue create` with a title matching the task description and a body that expands on what needs to be done.
- Note the issue number returned.

### 2. Create a feature branch and initial commit

- Branch from `main` with a descriptive name (e.g., `debounce-youtube-fetch` for task 2).
- Make an initial empty commit or a small scaffolding commit that references the issue: `Link task TASK_NUMBER to GitHub issue #<issue-number>`.

### 3. Check the environment

- Before running any build, test, or deploy commands, ensure the correct environment is activated (devenv, nix shell, virtualenv, Docker network). Do not assume the environment is ready.
- Read `CLAUDE.md` and `README.md` to identify the project's expected toolchain and environment setup. Verify by running a quick sanity check (e.g., checking that the expected runtime and package manager are available) and confirm the expected tools are present.
- If the environment is not active, activate it before proceeding.

### 4. Implement the task

- Plan first, then implement. Run the project's build and lint commands (as documented in `CLAUDE.md` or `README.md`) to verify your changes compile and lint cleanly.
- Make incremental commits as you go.

### 5. Mark the task as done

- Edit `TASKS.md`: change `[ ]` to `[x]` for task **#TASK_NUMBER**.
- Commit this change to the branch with the message: `Mark task TASK_NUMBER as completed in TASKS.md`.

### 6. Verify before submitting

- Run the project's test, lint, and build commands (as documented in `CLAUDE.md` or `README.md`). All must pass before proceeding.
- If any fail, fix the issues and commit the fixes before continuing.

### 7. Create a pull request

- Push the branch and open a PR with `gh pr create`, linking the issue in the body (use `Closes #<issue-number>`).
- The PR title should be concise and the body should summarize the changes.
- The PR must include the TASKS.md check-off commit alongside the implementation commits.

### 8. Report back

- Print the PR URL and issue URL so the user can review.
