# CTO Learning Module Dashboard Plan

## Intent
Build a CTO learning augmentation inside the new OpenClaw dashboard so the agent can help Christian learn, synthesize, and operationalize knowledge as part of normal work.

This is not a separate study app.
It is a dashboard-native operating lane that should:
- help decide what to learn next
- track what has been understood vs not understood
- turn learning into briefs, memos, experiments, and actions
- work as both a dedicated screen and a reusable set of widgets
- remain adaptable through the dashboard builder/layout system

---

## Product Thesis
Christian does not need a passive reading list.
He needs an executive learning system that sits inside the same environment where he manages work, agents, sessions, experiments, and decisions.

The module succeeds if it helps answer:
- What should I learn next?
- Why does it matter right now?
- What have I actually understood?
- What is still unclear?
- What output should be produced from this learning?
- What experiment or decision should this create?

If the module only tracks intake, it fails.

---

## Position In The Dashboard
The learning module should exist in two forms:

### 1. Dedicated screen
Add a first-class `Learning` screen for deep work, review, and synthesis.

This screen becomes the operator workspace for:
- learning focus
- queue management
- understanding capture
- output generation
- experiment shaping

### 2. Reusable builder widgets
Expose learning blocks as dashboard widgets so Christian can place them on:
- Overview
- Ops
- Chat
- Learning
- any future custom screen

This matches the long-term direction of the dashboard: modular, adaptable, and personal to the way Christian actually works.

The builder should treat learning as a widget family, not a one-off page.

---

## Best V1 Recommendation
For v1, do not try to build every possible learning surface.
Build the minimum set that makes the module operational inside the dashboard.

### Recommended v1 scope
- one dedicated `Learning` screen
- reusable learning widgets registered in the dashboard layout system
- one canonical structured learning state object
- chat/session linkage into a dedicated learning conversation
- ability for the agent to update the module state without hand-editing UI code

### Recommended v1 widgets
These are the best v1 widgets because they cover intake, understanding, output, and action without overbuilding:

#### 1. Learning Focus
Shows:
- primary learning theme
- current mode
- current objective
- current source pack
- last session
- next target session

Why v1 needs it:
- gives immediate orientation
- anchors the rest of the learning lane

#### 2. Next Best Action
Shows:
- one recommended next learning move
- why this is the next move
- expected duration
- expected outcome

Why v1 needs it:
- removes friction
- prevents browsing and context-loss

#### 3. Source Queue
Shows:
- queued sources
- type
- priority
- estimated time
- why each matters
- status (`queued`, `in-progress`, `reviewed`, `archived`)

Why v1 needs it:
- turns content into a managed pipeline

#### 4. Understanding Board
Shows:
- current working thesis
- key takeaways
- open questions
- unresolved contradictions
- confidence level

Why v1 needs it:
- learning without synthesis is low value

#### 5. Output Queue
Shows:
- artifacts to produce
- audience
- state
- due/urgency
- source linkage

Why v1 needs it:
- keeps learning tied to leverage

#### 6. Experiment Pipeline
Shows:
- captured ideas
- refined ideas
- ready-for-review ideas
- assigned/tested ideas

Why v1 needs it:
- creates a direct path from learning to action

### Not recommended for v1
- a fully separate learning-specific chat implementation
- NotebookLM-specific UI
- complex scoring systems
- large library management
- automatic parsing of arbitrary documents at render time

Those should come later.

---

## Source Of Truth
By "source files," this plan means the canonical data sources the dashboard reads from and the agent writes to.

The dashboard should not scrape random markdown files directly in the browser.
It should read a canonical structured state file produced by the harness/agent layer.

### Recommended canonical state file
- `data/dashboard/learning-module.json`

This should be the dashboard-facing source of truth for the module.

### Recommended supporting source folders
- `docs/learning/`
- `docs/research/`
- `docs/dashboard/plans/`
- workspace notes and durable learning docs outside the dashboard repo, if needed

These supporting sources are for authoring and synthesis.
They should feed the canonical JSON state through agent/harness updates, not through live ad hoc parsing in the UI.

### Recommended generated outputs
- `docs/learning/briefs/`
- `docs/learning/memos/`
- `docs/learning/experiments/`
- `docs/learning/source-packs/`

---

## Functional Architecture

### Dashboard layer
The dashboard should consume:
- `learning-module.json`
- widget layout definitions
- screen layout configuration

The dashboard should expose:
- a dedicated `Learning` route
- learning widgets for the builder
- actions that open or continue a learning session in chat

### Harness/agent layer
The harness should be able to:
- update focus
- reprioritize the queue
- append takeaways
- generate output tasks
- move experiment candidates through stages
- recommend the next best action

### Chat/session layer
Do not create a second learning chat system.
Use the existing chat system with a dedicated learning session key such as:
- `learning:main`

The learning module should deep-link into that session with context, for example:
- "continue current learning thread"
- "summarize source pack"
- "convert notes into leadership memo"
- "turn takeaways into experiment candidates"

---

## Recommended Data Model

```json
{
  "learning": {
    "focus": {
      "primaryTheme": "Incoming CTO",
      "currentDomain": "Platform strategy",
      "mode": "default",
      "objective": "Understand the current system deeply enough to make decisions",
      "currentSourcePackId": "clarity-idp-pack",
      "lastSessionAt": "2026-03-08T13:30:00Z",
      "nextSessionTargetAt": "2026-03-08T17:00:00Z"
    },
    "nextAction": {
      "title": "Review the current architecture notes",
      "reason": "Needed before shaping the next experiment",
      "etaMinutes": 25,
      "expectedOutcome": "Updated thesis and 2 experiment candidates"
    },
    "queue": [
      {
        "id": "src-001",
        "title": "Clarity architecture notes",
        "type": "internal-doc",
        "priority": "high",
        "etaMinutes": 25,
        "status": "queued",
        "why": "Needed for current platform decisions"
      }
    ],
    "understanding": {
      "workingThesis": "The current system can support growth if orchestration and surface design are aligned.",
      "takeaways": [
        "The dashboard should become the operator shell",
        "Learning needs to generate outputs, not just notes"
      ],
      "openQuestions": [
        "Which artifacts should be generated automatically?",
        "What should be private vs shareable?"
      ],
      "confidence": "medium"
    },
    "outputs": [
      {
        "id": "out-001",
        "title": "Leadership memo on dashboard direction",
        "type": "memo",
        "audience": "leadership",
        "status": "draft",
        "linkedSourceIds": ["src-001"]
      }
    ],
    "experiments": {
      "captured": 5,
      "refined": 2,
      "ready": 1,
      "assigned": 0,
      "tested": 0
    },
    "session": {
      "key": "learning:main",
      "label": "CTO Learning"
    }
  }
}
```

---

## Required Dashboard Behaviors

### The Learning screen must support
- seeing the full current learning state in one place
- switching from review to action quickly
- opening the linked learning chat session
- jumping from queued source to output or experiment
- being rearranged through the builder system

### Learning widgets must support
- placement on any screen
- resizing
- title overrides
- optional compact vs expanded display states
- future per-widget filters

### The builder must support
- registering a `learning` widget family
- dropping learning widgets onto any editable screen
- saving layout changes without special-case code

---

## Operator Flows

### Flow A: start-of-day orientation
Christian opens the dashboard and sees:
- current learning focus
- one recommended next action
- current open questions
- outputs waiting to be produced

### Flow B: active learning session
Christian opens a source from the queue, reads/listens, then asks the agent to:
- summarize it
- connect it to current work
- update the working thesis
- capture questions

### Flow C: synthesis to output
From the module, Christian or the agent converts the current learning state into:
- memo
- brief
- source pack
- experiment candidate

### Flow D: learning to action
An insight becomes:
- an experiment
- a task
- an ops item
- a shareable artifact

This is the main point of the system.

---

## Phased Delivery

### Phase 1: structured visibility
Deliver:
- canonical JSON state
- dedicated `Learning` screen
- reusable learning widgets
- learning session link into chat
- manual or agent-driven updates to the state file

Success condition:
- Christian can see and use the learning lane inside the dashboard daily

### Phase 2: guided action
Deliver:
- next-best-action generation
- output queue actions
- experiment promotion actions
- source state transitions

Success condition:
- the module drives actual operator behavior, not just display

### Phase 3: automation and expansion
Deliver:
- harness updates from source documents
- auto-generated briefs/memos
- source pack lifecycle
- smarter prioritization
- richer widget variants

Success condition:
- the agent helps maintain the learning system with low manual effort

---

## Integration Requirements For The New Dashboard
This module must integrate with the dashboard currently being built, not sit beside it.

That means:
- it uses the same layout/builder system
- it uses the same chat/session system
- it uses the same shell and module architecture
- it can appear on Overview, Ops, Chat, and Learning through widgets
- it follows the same PWA/responsive rules as the rest of the dashboard

---

## UI/UX Boundary
Functional direction should be defined here first.
Visual refinement can be handed to external UI reviewers later.

The functional spec that UI should not break:
- learning remains a modular widget family
- the dedicated Learning screen remains builder-driven
- the primary interaction model is review -> synthesize -> output -> experiment
- chat linkage is session-based, not a detached special tool
- the operator can compress the module into summary widgets or expand it into a full workspace

---

## Success Metrics
The module is working if:
- Christian uses it daily or near-daily
- there is always one clear next learning action
- open questions are visible and current
- outputs are regularly produced from learning
- experiments and decisions can be traced back to learning inputs
- the module can be rearranged without rewriting UI code

---

## Immediate Build Recommendation
Start with:
1. `Learning` as a new dedicated dashboard screen
2. six v1 learning widgets
3. `data/dashboard/learning-module.json` as the canonical module state
4. a dedicated `learning:main` chat session
5. builder registration so the widgets can be placed anywhere

This gives the learning lane a real operational footprint without turning it into a separate product.

---

## Final Rule
The CTO learning module must help Christian learn, decide, and ship.

If it only helps him collect content, it is the wrong module.
