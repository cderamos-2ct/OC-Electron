# NOTEBOOKLM_SOURCE_PLAN.md

## Purpose
Define how NotebookLM should be used as part of Christian's incoming-CTO learning system.

The point is not to dump everything into NotebookLM.
The point is to create curated source packs that can be turned into:
- audio/podcast-style review
- fast synthesis
- better recall while driving/working
- usable downstream outputs

## Core rule
**NotebookLM is a conversion layer, not a junk drawer.**

If a source pack is too broad, mixed, or noisy, it should be split before ingestion.

---

## Recommended notebook structure

### 1) ServFlow CTO Core
Purpose:
- top-level CTO learning stream
- recurring strategic themes
- AI/software/service-model thinking most relevant to Christian's role

Use for:
- high-signal external research
- selected strategic memos
- executive-level synthesis sources

### 2) Clarity / IDP / Platform Core
Purpose:
- internal source understanding
- SOWs
- diagrams
- architecture notes
- product/solution positioning

Use for:
- internal source docs only
- companion architecture/understanding notes

### 3) Future-Forward AI / Software Research
Purpose:
- bleeding-edge external research relevant to agents, orchestration, evals, workflow intelligence, document systems, voice, automation, etc.

Use for:
- curated external sources only
- not internal product docs

### 4) Experiment / Partner Brief Pack
Purpose:
- source material that feeds experiment proposals, partner briefs, and team-shareable summaries

Use for:
- distilled notes
- selected references
- future-forward concept packs

---

## Source-pack rules

### Good source pack
- single theme
- 5–20 meaningful sources max
- clear reason for existing
- obvious target output

### Bad source pack
- random pile of links
- mixed unrelated topics
- no output goal
- overloaded with duplicate or low-signal material

---

## Best source types for NotebookLM

### Excellent candidates
- internal markdown/docs
- architecture memos
- SOWs
- long-form essays
- curated research notes
- transcripts
- high-quality articles

### Good candidates with caution
- video transcripts
- podcast transcripts
- vendor docs
- product announcements

### Bad candidates
- random bookmarks
- shallow news blurbs
- noisy duplicate coverage
- anything Christian would never actually want summarized later

---

## Audio workflow

### Use case
Christian wants to digest useful material while:
- driving
- working
- moving between contexts

### Workflow
1. curate a source pack
2. load into the correct notebook
3. generate audio/podcast-style review
4. listen during low-friction time
5. follow with a written capture step

### Mandatory follow-through
After audio review, create one of:
- short brief
- key takeaways note
- question list
- experiment idea
- partner/team summary

If the audio never becomes a written output, it does not count as completed learning.

---

## Recommended first notebook packs

### Pack A — Clarity / IDP Understanding
Sources:
- Clarity SOW
- IDP SOW
- diagrams
- `CLARITY_IDP_UNDERSTANDING.md`

Target output:
- tighter understanding memo
- open questions
- working architecture/business thesis

### Pack B — CTO Core Future-Forward Pack
Sources:
- curated AI/software/operator research
- selected videos/transcripts
- strong essays/articles

Target output:
- weekly CTO brief
- future-forward experiment ideas

### Pack C — ServFlow Service Model Pack
Sources:
- service-delivery / MSP / platformized-services research
- selected internal positioning docs when they exist

Target output:
- service model and positioning notes
- org/operating implications

---

## Dashboard integration fields
The dashboard learning module should eventually show:
- active notebook
- active source pack
- last pack updated
- next pack to review
- target output from that pack

---

## Build order

### First
- use NotebookLM for `Clarity / IDP / Platform Core`

### Second
- build `Future-Forward AI / Software Research`

### Third
- build `Experiment / Partner Brief Pack`

---

## Rule
NotebookLM should reduce friction and improve recall.
It should not become a prettier place to lose information.
