---
inclusion: always
---

# AWS Kiro AI-DLC Challenge — Project Rules

## What This File Is

This steering file records the rules and constraints that govern this project as a challenge submission. All contributors and AI agents working in this workspace must follow these rules at all times.

## Core Honesty Constraint

**This application does NOT use machine learning, AI prediction, or any trained model.**

The application uses deterministic, formula-based calculations only. Any code, comment, UI text, or documentation that claims or implies AI/ML capability is prohibited and must be treated as a critical defect.

Permitted language:
- "calculated from recent sales data"
- "based on the last 7 days of recorded sales"
- "formula-based suggestion"
- "inventory health indicator"

Prohibited language anywhere in the application:
- "AI-powered"
- "predicted by AI"
- "machine learning"
- "neural network"
- "forecast" (unless clearly qualified as "formula-based forecast")
- "smart recommendation" (unless clearly qualified as formula-derived)

## Formula Integrity Constraint

Every calculation must match exactly the formulas defined in `calculation-rules.md`. Any deviation requires:
1. An update to `calculation-rules.md` first.
2. A corresponding update to `DECISIONS.md` explaining why the formula changed.
3. An update to all affected test cases.

## Sample Data Constraint

Demo and seed data must be clearly labelled "Sample data — for demonstration only" in the UI and in database seed scripts. No unlabelled invented data may be presented as real.

## Transparency Constraint

Every number displayed on the dashboard must be traceable to:
1. Raw user-entered data (sales records, product configuration).
2. One or more of the named formulas in `calculation-rules.md`.

Any number that cannot be traced this way must not appear on screen.

## Student Team Scope

This is a student project. The codebase must remain understandable to a junior developer. Avoid:
- Overly complex abstractions.
- Dependencies that require significant setup (no Docker requirement for local dev).
- Code that cannot be explained in a code review.

## Challenge Submission Checklist (to be verified before final submission)

- [ ] All formulas match `calculation-rules.md` exactly.
- [ ] No AI/ML language anywhere in UI, code comments, or README.
- [ ] Demo dataset is labelled "Sample data".
- [ ] Every calculated field has a visible formula trace in the UI.
- [ ] Unit tests pass for all formula functions.
- [ ] `DECISIONS.md` is complete and up to date.
- [ ] `README.md` explains how to run the project locally.
- [ ] All user inputs are validated on both frontend and backend.
- [ ] No hardcoded secrets or credentials.
