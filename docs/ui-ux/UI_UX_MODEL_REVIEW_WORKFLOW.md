# UI / UX Model Review Workflow

## Purpose
Ensure dashboard/UI decisions are not made by GPT-5.4 alone.

## Workflow
1. define the feature/module and its purpose
2. produce functional/data scaffolding
3. run Claude review for UX/layout/clarity critique
4. run Gemini review for alternative design/product perspective
5. synthesize into the chosen design direction
6. implement/update spec

## Why
Christian explicitly wants Claude and Gemini involved because GPT-5.4 is currently weak on UI/UX quality by itself.

## Rule
No important dashboard UI/UX decision should be treated as final until it has been reviewed by Claude and/or Gemini.
