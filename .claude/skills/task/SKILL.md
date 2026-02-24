---
name: task
description: Work on a task from TASKS.md by number
disable-model-invocation: true
user-invocable: true
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
argument-hint: [task-number]
---

# Work on a task from TASKS.md

You are working on task **#$ARGUMENTS** from `TASKS.md`.

## Setup

1. Read `TASKS.md` and find the task matching **#$ARGUMENTS**.
2. Verify the task is not already checked off (`[x]`). If it is, tell the user and stop.
3. Read the current git branch. If you are not on `main`, ask the user before proceeding.

## Workflow

Follow the instructions at the top of `TASKS.md`. Specifically:

### 1. Create a GitHub issue

- Use `gh issue create` with a title matching the task description and a body that expands on what needs to be done.
- Note the issue number returned.

### 2. Create a feature branch and initial commit

- Branch from `main` with a descriptive name (e.g., `debounce-youtube-fetch` for task 2).
- Make an initial empty commit or a small scaffolding commit that references the issue: `Link task $ARGUMENTS to GitHub issue #<issue-number>`.

### 3. Implement the task

- Plan first, then implement. Run `npm run build` and `npm run lint` to verify your changes compile and lint cleanly.
- Make incremental commits as you go.

### 4. Create a pull request

- Push the branch and open a PR with `gh pr create`, linking the issue in the body (use `Closes #<issue-number>`).
- The PR title should be concise and the body should summarize the changes.

### 5. Mark the task as done

- Edit `TASKS.md`: change `[ ]` to `[x]` for task **#$ARGUMENTS**.
- Commit this change to the PR branch.

### 6. Report back

- Print the PR URL and issue URL so the user can review.
