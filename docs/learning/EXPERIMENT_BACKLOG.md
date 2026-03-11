# EXPERIMENT_BACKLOG.md

## Purpose
Track future-forward experiments that emerge from Christian's CTO learning, source-doc digestion, and ongoing research.

This backlog is for ideas that are worth testing — not just interesting thoughts.

It should help answer:
- what should we test next?
- why does it matter?
- who is it for?
- what is the smallest useful validation step?

---

## Status definitions
- **captured** — idea exists, not yet shaped
- **refined** — idea has clear upside/risk/test shape
- **ready** — ready for leadership/dev review
- **assigned** — someone owns the next step
- **tested** — experiment executed
- **dropped** — no longer worth attention

---

## Experiment template

### Title

### Status
- captured / refined / ready / assigned / tested / dropped

### Relevance
- ServFlow / Visual Graphx / ServRx / Process Matters / Position Sports / cross-entity / client-specific

### Type
- product
- architecture
- workflow automation
- AI/agents
- service model
- ops/internal tooling

### Why now
Why this matters in the current moment.

### Expected upside
What gets better if this works?

### Main risk / uncertainty
What might make this a bad bet?

### Smallest useful test
What is the fastest non-bullshit way to validate it?

### Inputs needed
- people
- data
- tools
- docs
- time

### Shareability
- private only
- leadership-shareable
- team-shareable

### Notes

---

## Initial seed ideas

### 1) Consensus + contention evaluation harness for document extraction
- **Status:** captured
- **Relevance:** ServFlow / cross-entity
- **Type:** architecture
- **Why now:** the IDP strategy appears to lean heavily on multi-model routing/consensus, which means evals and contention analysis could become a real moat instead of hand-wavy model selection
- **Expected upside:** better confidence calibration, faster improvement loops, clearer routing logic, less blind faith in model output
- **Main risk / uncertainty:** could become over-engineered before the core flows are stable
- **Smallest useful test:** define 3–5 document classes, run two or more extraction approaches against them, compare agreement/disagreement patterns, and review where human correction would actually matter
- **Shareability:** leadership-shareable / team-shareable

### 2) Human-review intelligence layer
- **Status:** captured
- **Relevance:** ServFlow / ServRx
- **Type:** workflow automation
- **Why now:** if human review stays expensive, the review tooling itself becomes strategic product surface rather than operational tax
- **Expected upside:** lower review friction, better correction capture, stronger learning loop, better auditability
- **Main risk / uncertainty:** easy to underestimate UX/process complexity
- **Smallest useful test:** map current review decisions into a structured capture model and prototype one review flow with explicit correction reasons + outcomes
- **Shareability:** leadership-shareable / team-shareable

### 3) Vertical adaptation profile framework
- **Status:** captured
- **Relevance:** ServFlow / cross-entity / client work
- **Type:** product
- **Why now:** the Clarity strategy appears to depend on configurable multi-vertical adaptation rather than endless bespoke rebuilding
- **Expected upside:** faster onboarding, stronger repeatability, clearer service/product boundary
- **Main risk / uncertainty:** could be too abstract if not grounded in real client/document patterns
- **Smallest useful test:** define one profile structure and apply it across two distinct verticals to see what is truly reusable vs bespoke
- **Shareability:** leadership-shareable / team-shareable

### 4) NotebookLM-to-brief workflow for executive learning
- **Status:** captured
- **Relevance:** cross-entity
- **Type:** ops/internal tooling
- **Why now:** Christian explicitly wants learning that can survive driving/work time and convert into usable outputs
- **Expected upside:** better knowledge retention, faster executive synthesis, lower friction for staying current
- **Main risk / uncertainty:** becomes another content sink if not paired with a required output step
- **Smallest useful test:** build one curated source pack, review it through NotebookLM audio, then force conversion into one short brief and one experiment candidate
- **Shareability:** private only / leadership-shareable

---

## Rule
If an experiment does not have a smallest useful test, it is not ready.
