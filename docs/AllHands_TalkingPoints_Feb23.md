# All-Hands Tech Meeting — Talking Points
**Monday, February 23, 2026 | 2:30–3:30 PM MST**

**Attendees:** Christian (VG) · Kyle Lasseter · Craig Brown · Eric Rosenfeld · Todd Delano · Mark Smith (CFO) · John Flynn (Legal)

---

## 1. Why We're Here

I want to use this time to give everyone a clear picture of the active project portfolio that's been assembled through my engagement with Kyle over the past several weeks. This isn't a status report on any single project — it's a full-scope view of what I've been asked to build, lead, or support, so we can align on priorities, resources, and governance going forward.

One thing I want to name upfront: what I'm presenting today is what's been formally surfaced to me. Kyle and I have had conversations that suggest there are likely additional projects in his pipeline that haven't reached me yet in a structured way. I'm flagging that now so we're not surprised later.

---

## 2. The Core Platform: Clarity

**Clarity** is the foundation everything else is building on or flowing through. It's an AI-powered document validation and routing platform — multi-tenant, built on .NET 8, Next.js 16, PostgreSQL, Redis 7, deployed via AWS ECS Fargate.

- **Current status:** ~90% complete
- **Beta target:** February 28, 2026
- **Go-live:** March 7–10, 2026
- **Live dev environment:** https://dev-clarity.visualgraphx.com/admin

Clarity is not just one client's tool. It is being built as shared infrastructure for multiple projects in this portfolio. That has resource and timeline implications worth understanding together.

---

## 3. The Bigger Picture — What We're Actually Building

Before I walk through the project list, I want to frame what these non-print projects represent collectively, because individually they look like a list of client asks. Together they are something much larger.

**The Four Pillars of Document Processing:**

Every non-print engagement in this portfolio falls into one of four verticals — BPO, Manufacturing, Legal, and Medical. These aren't arbitrary categories. They are the four largest document-intensive industries in the world, and they all share the same core problem: high-volume, error-prone, manual document handling that needs to be automated, validated, and auditable.

- **BPO (Business Process Outsourcing)** is the whale. The addressable volume here is measured in billions of pages annually. If we establish a foothold here, the scale potential dwarfs everything else in this portfolio.
- **Manufacturing** (Hatco, G&C) is where we're already proving the model — order processing, vendor quotes, document routing.
- **Legal** (Litify/Fendon Law) and **Medical** are natural extensions of the same infrastructure. The compliance and validation requirements are higher, but so are the margins.

All four verticals interconnect at the infrastructure layer. That's the key insight — you don't build four separate platforms. You build one knowledge and validation layer, and you serve all four from it.

**The 1-2 Punch: Clarity as the Knowledge Layer + HITL Infrastructure**

We've taken Klippa to the dance — they're our current OCR and extraction partner. That's working. But Eric's vision points to something more valuable: an enterprise-grade architecture that reduces external vendor dependency over time and increases our own platform equity.

The play is:
- **Clarity as the knowledge and learning layer** — every document that flows through builds the model, improves confidence scoring, and increases the platform's intelligence over time. This is the enterprise value multiplier.
- **HITL (Human-in-the-Loop) infrastructure** — a purpose-built validation and human precision layer sitting between AI extraction and downstream systems. This is where accuracy becomes a product, not just a feature.

Together, these two layers create a defensible enterprise platform — not a vendor integration stack.

**Eric's Vision: The Case for Building Our Own**

I want to be transparent with this group — I've been thinking about the direction Eric has pointed toward, and I believe it deserves a direct conversation here. The recommendation I'm working toward is this: use Klippa as a bridge and learning tool right now, but fast-track our own solution for long-term enterprise value. Here's why.

**The Klippa Concerns**

Klippa is functional and it's gotten us this far. But there are open questions about its longevity as a foundational dependency that this group should be aware of before we build deeper:

- **Data residency:** From what we can tell, Klippa is routing document data through Germany. For clients in Legal, Medical, and any regulated BPO context, this is a compliance exposure. U.S. data sovereignty is not optional in those verticals.
- **IP and protectability:** Klippa's stack is substantially built on open-source tooling. That's not inherently disqualifying, but it raises questions about what is actually proprietary and defensible in their offering — and whether we're paying for a commodity wrapper.
- **Cost and throughput:** We have unresolved questions around per-page processing cost at scale and latency under high volume. At BPO-level page counts, these economics matter enormously.
- **Model generation:** Klippa's OCR model is older-generation and still being trained. Newer multimodal OCR models available today have meaningfully better accuracy, lower inference cost, and broader document type support. We are building on a vendor who is behind the current state of the art.
- **Single-modality ceiling:** Klippa is fundamentally an OCR extraction layer. It doesn't account for multi-modal document understanding — layout reasoning, visual context, agent-driven extraction logic. As we move into complex document types (Legal filings, Medical records, BPO mixed-format batches), a pure OCR approach will hit a ceiling.

**The Bridge Strategy**

The right move is not to abandon Klippa today — the Annotation opportunity with Klippa is real and valuable. Annotating their models gives us hands-on training data experience and lets us build an internal annotation team that becomes the seed of our own model training capability. We learn on their infrastructure while building ours.

But in parallel, we fast-track our own extraction and understanding layer — one that integrates directly into the Clarity platform. Instead of two separate data processing systems (Klippa out, Clarity in), we build a unified pipeline where document understanding, extraction, validation, and learning all happen inside one enterprise stack. That is the one-stop shop that creates real enterprise value and eliminates the external dependency risk entirely over time.

**The Annotation Opportunity**

Near-term: partner with Klippa on annotation to train their models and generate revenue. Medium-term: use that work to build and mature our internal annotation team. Long-term: own the training data, own the models, own the accuracy — and that becomes a competitive moat no one can easily replicate.

**AI Security**

As we move into Legal and Medical, we also need to begin thinking seriously about AI penetration testing and threat mitigation. Adversarial document inputs, model manipulation, and data pipeline attacks are real threat vectors in regulated industries. This is not an immediate build item but it needs to be on the roadmap now, not after the first incident.

**The Hidden Advantage: Autonomous Coding Infrastructure**

One thing I want this group to understand that doesn't show up in any client SOW: we have been building our own autonomous coding infrastructure — an internal development acceleration platform. The team is already using the tools we've built as part of this process, and the productivity gains are significant. This is giving us capabilities that most engineering organizations of our size don't have.

This matters strategically for two reasons. First, it means our team can move faster and with higher quality than the headcount alone would suggest — which directly improves the economics of everything in this portfolio. Second, and more importantly for Eric: this infrastructure is transferable. If Eric wants to build additional teams, spin up new engineering capacity, or reutilize our processes and tooling elsewhere, the autonomous coding infrastructure is the bridge that makes that possible without starting from scratch. This is a shared asset for the group, not just a VG internal tool.

**The point:** the project list I'm about to walk through isn't just a collection of client requests. It's the early proof-of-concept layer of a document intelligence platform with genuine enterprise scale. The decisions we make in this room about structure, investment, and direction will determine whether we capture that opportunity or just execute it for someone else.

---

## 4. Projects Kyle Has Engaged Me On

What follows is every project Kyle has explicitly asked me to lead, build, or coordinate — sourced from our direct email and communication history going back to January 2026. I've grouped them by type.

---

### A. Platform Integrations — Feeding Into or Alongside Clarity

**① Hatco — Order Email Processing**
Kyle formally handed this to me in early February. The ask: integrate Hatco's order emails into an automated processing pipeline using Klippa/Doxis (DocHorizon API). This is a direct Clarity integration.

**② Klippa / G&C — Document Processing**
A new project surfaced February 20. G&C has an active need for document OCR and processing. Vendor quotes from Klippa are in. Same vendor stack as Hatco, separate client engagement. Scope and billing structure needed.

**③ City of LA — Daily Dashboard / Reporting**
Kyle has been forwarding City of LA data reporting work to me. Current data source is a Google Sheet via Dataswarm/Arun Jayasimhan. This is a reporting and dashboard build currently tied into the Clarity infrastructure.

---

### B. Client Platform Builds

**④ POP System — Pop Logic / Precision POP**
Active build for Covalience/AlphaGraphics (Lynn Nelson). Phase 1 is scoped at **$105,143.10 over 4 months**. Full coordination has been running since January. This is the largest single revenue engagement currently active.

**⑤ Litify / Fendon Law — Legal Case Management Integration**
Kyle introduced me to Lindsay Rials at Fendon Law on February 12. The ask is to build a Litify integration (Salesforce-based legal platform). Sandbox and API access not yet confirmed. Early stage but active.

---

### C. Active Business Development / Revenue Projects (Kyle-Sourced, Already Underway)

**⑥ Triangle Design — Web Store**
Kyle introduced me to Mike Mcilwain on February 10. Work has already started. Client relationship and billing ownership not yet formally defined — that needs to be resolved.

**⑦ Presario — B2B Platform**
Kyle asked about setting up a B2B platform on February 20. Work has already started. No SOW, no formal billing structure in place yet.

**⑧ POA / Whitewolf — Integration**
An additional engagement is being asked of me by Kyle — POA/Whitewolf want further integration work started. This is a new ask that hasn't been formally scoped or structured yet.

**⑨ ERP + eCommerce Ecosystem**
This is a market opportunity Kyle has been driving — he has identified potential customers, including **POA Partners** and **AlphaGraphics**, who want a complete ERP + eCommerce ecosystem. Kyle has asked me to take the lead on this, given that I've been building toward exactly this kind of system and have deep operational experience on the eCommerce side.

The strategic question this group needs to weigh in on: **do we accelerate the VG platform build and convert it to multi-tenant to serve this opportunity — or do we do more revenue and market research before committing resources?** This isn't a decision I should make unilaterally. It has implications for VG's roadmap, team capacity, and how we position the platform commercially.

---

### D. Shared Development Resources

**⑩ PrintDeed / Dev Team (Indian Labor Contractor)**
This is my contract team — built by me for VG projects. PrintDeed operates as our Indian labor contractor, providing the team as a labor service. This structure was established intentionally to reduce direct exposure to Indian labor law while maintaining full operational control on the VG side. The team includes Tanishq Gupta, Sunny Tomar, Ayushi Mehta, Chetan Mevada, Jinkal, Reena Rathod, Sinchana, Dhruv, and 6 additional interns. I am the direct relationship and the operational bridge. Worth confirming with John that the contractor structure is properly documented and legally sound as the engagement scales.

---

## 6. Resource Picture

The team currently supporting this portfolio is **9.3 FTE**:

| Name | Title | Level |
|---|---|---|
| Tanishq Gupta | Senior Team Lead Developer | Senior |
| Sunny Tomar | Senior Developer | Senior |
| Ayushi Mehta | Vision AI Specialist / Developer | Mid |
| Reena Rathod | AI Coding Developer | Junior |
| Sinchana | UI/UX | Intern |
| Dhruv | Developer | Intern / Junior |
| Chetan Mevada | DevOps Specialist & Chief PM | Senior |
| Jinkal (Jingle) | PM / QA Tester | Mid |
| 6 additional interns | Development support | Intern |

**Engineering cost: approximately $11,200/month**

**Team Structure Note:** The team is engaged through our relationship with PrintDeed in India, which functions as an Indian labor contractor. PrintDeed provides Indian labor as a service, and this structure is intentional — it reduces our direct exposure to Indian labor law while maintaining operational control and team continuity on our side. This arrangement has legal and contractual dimensions worth ensuring are properly documented. John, this is worth a brief flag on your end if it hasn't already been formalized.

This team is carrying Clarity, Hatco, G&C, City of LA, POP System, and everything else listed above — simultaneously. The scope I've just walked through represents significant concurrent load on a team that was originally built for a different mandate.

---

## 7. What I Need From This Room

**Alignment on scope and sequencing.** I am being asked to run multiple engagements in parallel. Some are revenue-generating, some are infrastructure, some are exploratory. I need this group's direction on priority when there is resource conflict — and there will be.

**Governance on how project asks reach me.** Several of these engagements came to me directly from Kyle without prior partner discussion. I understand how Kyle operates and I'm not raising this as a complaint. But for projects above a certain size or risk threshold, I need to know who the decision-makers are and what the billing structure is before I'm asked to build.

**A decision on the ERP/eCommerce opportunity.** Kyle has identified real potential customers. Whether we pursue this needs to be a group decision — not something I inherit as a build task without strategic alignment.

**A group conversation on Eric's vision for the platform.** I've laid out the strategic case in Section 3. I want to know whether this group is aligned on prioritizing the build of our own document intelligence layer, and whether we're prepared to invest in that direction intentionally rather than letting it happen reactively.

---

### My Commitment — and What I Need to Make It Real

I want to be direct with this group: I am fully committed to making this succeed. I am willing to take on additional roles and responsibilities to see it through. That's not a caveat — it's a statement of intent.

But for me to operate at the level this portfolio demands, I need a few things from this group:

**Close the VG Merger gaps.** I need the partnership structure formalized. I can't build toward a shared future on an open foundation. John, this comes back to you.

**Formally transition VG's operational role.** The VG leadership team is already in place and operates independently. What I need from this meeting is the formal acknowledgment that I am moving from an operational role into a strategic oversight role — and that a named leader is announced to own daily operations in my place. The team is capable. This is about making the structure official so everyone, internally and externally, knows who owns what.

**Labor resources to execute.** The VG team already knows the goals — growth, revenue, and profit targets are clear. With me stepping out of the daily knowledge base role and promoting one of our existing leaders to operational head, there will be a production labor gap that needs to be filled. We will likely need two additional low-wage technicians to maintain throughput at a level sufficient to hit our targets. That's a straightforward hire — low cost, high impact on daily output.

**A heartbeat check on VG operations.** For the broader project portfolio, I am the direct owner and PM — that's my role and I own the visibility there. What I need is a structured way to stay connected to VG's internal operations as I step back from the daily role. A regular pulse check on VG health, blockers, and team wellbeing — not micromanagement, just a rhythm that keeps me informed without requiring me to be present in the day-to-day.

**Dedicated dev time to complete the SSOT project.** VG's Single Source of Truth application is our internal growth accelerator — the foundation that lets VG scale without operational chaos. I was leading the build, but I can no longer be the one building it. I need to allocate dedicated dev resources and protected sprint time to see it through to completion. I want to close this out personally from an oversight standpoint. This is not a Kyle project. It needs to be protected from being deprioritized every time a new client ask comes in.

---

## 8. One Thing I Want to Be Clear About

What I've listed today is what's been formally surfaced to me. I have every reason to believe there are additional projects in Kyle's pipeline that haven't reached me yet in a structured way. I'm raising this not to create alarm but because our team's capacity is finite — and I want leadership to have a realistic picture of what's coming, not just what's already here.

---

*Prepared by: Christian | Visual Graphx | February 23, 2026*
*Sources: Direct email history with Kyle Lasseter, January–February 2026*
