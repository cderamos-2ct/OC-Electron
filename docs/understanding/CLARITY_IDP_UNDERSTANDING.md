# Clarity / IDP Understanding

## Status
Initial understanding memo based on direct review of the internal Clarity markdown SOW and the known companion IDP materials.

This is a working document, not the final truth.
It should tighten as more of the source set is digested.

## Current high-confidence read

### 1) Clarity is the strategic front door
Clarity is being framed as the **entry-point solution platform**, not just an add-on feature behind the scenes.

That matters because it changes the go-to-market position:
- without this framing, ServFlow is just another IDP vendor
- with this framing, Clarity can be sold into environments that already have upstream extraction systems
- once Clarity is in, ServFlow IDP becomes the deeper native pathway and natural upsell

Blunt version:
**Clarity is the door. IDP is what sits behind it.**

## 2) Clarity and IDP are separate but designed to compound
The current architecture positioning appears to be:
- **Layer 1:** IDP = ingestion, classification, extraction, field confidence
- **Layer 2:** Clarity = validation, interpretation, matching, inference, action routing
- **Layer 3:** storage/document management = long-term archive and lifecycle

So the systems are related, but not the same thing.

### Practical implication
The real differentiation is probably not "we extract documents too."
It is:
- system-agnostic ingestion
- validation/intelligence/business-logic layer
- accumulated knowledge and adaptation
- reduced human review burden over time

## 3) The platform ambition is multi-tenant and multi-vertical
Clarity is not being described as a single-client custom app anymore.
It is being generalized into a framework serving at least:
- Medical
- Legal
- Manufacturing
- Government

That tells me the product ambition is not a one-off services wrapper.
It is a reusable framework that can be configured per client/vertical.

## 4) The economic play is stronger than simple extraction
The SOW explicitly points at a move from raw extraction economics toward:
- validated delivery
- better margins via auto-approval and reduced review
- upsell from Clarity-only into full ServFlow stack
- higher switching costs through business logic, reference data, and learned patterns

That suggests the strategic moat is supposed to come from:
- customer-specific logic
- validation confidence system
- adaptation profiles
- accumulated knowledge layer
- operational cost advantage

## 5) The current implementation is not vapor
The memo describes a real beta/current-state implementation, initially for Hatco, with enough specificity to suggest this is already a meaningful working base rather than slideware.

The current-state description includes things like:
- multi-tenant architecture
- weighted confidence scoring
- webhook ingestion
- review queue
- auth/encryption model
- admin dashboard
- containerized deployment readiness
- concrete stack choices (.NET / Next.js / PostgreSQL / Redis / Docker)

That means the next research/learning work should treat this as an actual product/platform evolution problem, not a blank-sheet ideation exercise.

## What I think you are really building

### Clarity
A configurable document-intelligence framework that sits between raw extraction and business action.

Its job is not just to "read documents."
Its job is to:
- validate extracted/structured data
- understand what the data means in context
- apply client + vertical logic
- determine what should happen next
- learn over time

### ServFlow IDP
The native upstream engine/pathway that makes Clarity better when the full stack is deployed together.

Its job is more specifically shaping up as:
- ingest documents at scale
- classify and intelligently route them
- extract structured data
- run multi-model consensus / contention / confidence logic
- support HITL correction loops
- feed Clarity the richest possible structured input plus provenance/confidence metadata

The IDP memo language makes it clear this layer is being designed as the foundational processing engine under a three-layer stack:
- Layer 1: IDP / document intelligence
- Layer 2: Clarity / validation intelligence
- Layer 3: document management / storage

### Combined value proposition
The full stack becomes:
- ingest anything
- classify and route intelligently
- extract with consensus/confidence handling
- validate deeply
- interpret in business context
- route/action it with less human labor
- improve over time through correction-driven learning loops

## Open questions I need to answer from the rest of the source set

### Product / strategy
- Is Clarity intended to be sold as a standalone product, a framework-backed service, or both?
- How much of the offering is repeatable product vs bespoke implementation?
- What is the real wedge by entity/vertical first?

### Architecture
- What is the canonical data model?
- How is the knowledge layer actually structured?
- How are vertical profiles represented?
- Where do AI/ML techniques really sit versus rules/configuration?

### Commercial / operating model
- What is the service boundary between Visual Graphx, ServFlow, and the other entities?
- Which parts are managed service, which are platform, and which are custom dev?
- What delivery model is implied for bespoke client builds?

### Dev-team / future-forward opportunity
- where evals and feedback loops could become a moat
- where agentic workflow/orchestration could add real value rather than hype
- where vertical adapters become product leverage
- where human review tooling could become a compounding asset

## Immediate next reads
- the ServFlow IDP platform SOW in more detail
- Clarity sections on:
  - validation engine
  - knowledge layer / inference engine
  - vertical adaptation
  - success criteria / KPIs
  - open architecture decisions
- diagram / metadata contract artifacts that explain the cross-layer model

## Additional IDP-side understanding

### Current driver for building the IDP layer
The IDP SOW frames the current third-party state as strategically broken, not just mildly annoying.

Key issues called out include:
- extraction rates below target
- human-in-the-loop volume that stays too high
- no real learning from corrections
- poor confidence calibration and model confusion
- weak reuse across projects/clients
- loss of data-control boundary because processing happens in vendor-controlled cloud environments
- limited flexibility across multiple verticals/use cases

That means the build is not just about better accuracy.
It is also about:
- owning the platform
- owning the data boundary
- owning the learning loop
- making implementation reusable across many clients/entities

### Architectural differentiator emerging from the IDP side
The IDP layer is not being framed as a single-model extractor.
It is being framed as an orchestrated architecture with:
- classification-driven routing
- multiple extraction paths/models
- multi-model consensus (`Confer / Contend / Concur`)
- human review when needed
- continuous learning from corrections

That is important because it suggests the future moat is not one magic model.
It is the orchestration + feedback system.

## Working thesis
The real business opportunity is not "OCR but better."
It is an **owned, framework-driven document intelligence stack** where:
- the IDP layer handles ingestion, classification, extraction, routing, and correction-aware learning
- Clarity handles validation, interpretation, intelligence, and business actioning
- the combined system can enter through services, land as a solution, and expand into a deeper native platform relationship
