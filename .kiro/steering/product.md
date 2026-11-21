---
title: Product Rules - Truth vs Show Layer
inclusion: always
---

# Product Rules: Truth Layer vs. Show Layer

## Core Principle

The board never feeds back into the score. Labels always come from the eval swing.

## Two Layers

### Truth Layer (The Analysis)
- **What it is**: The eval bar, labels, reasons, and scores
- **Source**: Computed from real impact data
- **Components**:
  - Commit scores derived from CI results, hindsight, diff complexity, scope creep, and LLM rubric
  - Labels: Brilliant, Best, Good, Inaccuracy, Mistake, Blunder
  - Eval swing that determines each label
  - "Best Move" suggestions for bad commits

### Show Layer (The Visualization)
- **What it is**: The chess board animation
- **Source**: Generated from the truth layer
- **Rule**: This is illustrative only. It never influences the score.
- **Flow**: Truth layer → Show layer (one-way only)

## Label Assignment

Labels come from the eval swing based on:
1. CI results (pass/fail)
2. Hindsight (was it reverted or fixed later?)
3. Diff size and complexity
4. Scope creep
5. LLM rubric that cites evidence

The board reads these labels and maps them to move types, but the pieces don't encode real meaning.

## Chess Game Generation

- Pre-made game library matched to commit count and outcome
- Each label maps to a move type (blunder → punished move, brilliant → brilliant move, plain → developing move)
- Ending determined by PR outcome:
  - Failed CI → black checkmates
  - Passing CI → white wins
  - Fix after failing → blunder then recovery
  - Unresolved PR → draw
- Cosmetic checkmate banner as fallback
- Long PRs capped at 8-12 board moves by grouping commits

## Consistency Rule

Keep the eval bar and board consistent by:
1. Computing truth layer first
2. Reading labels from eval swing
3. Generating board from those labels
4. Never letting board state influence scores
