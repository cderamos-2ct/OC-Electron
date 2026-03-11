# ALL-HANDS TECH MEETING BRIEFING
## February 23, 2026 | 2:30–3:30 PM MST

---

## EXECUTIVE SUMMARY

**What we're here to discuss:**
- **Clarity platform is 90% complete** — beta Feb 28, go-live Mar 7–10. This is our foundational SSOT for enterprise automation.
- **9 active revenue-generating projects worth $100K+** are now under unified governance, but need formal resource commitment and decision authority.
- **Christian is ready to step into strategic project management** across four verticals (BPO, Manufacturing, Legal, Medical), but needs: VG merger gaps closed, governance structure formalized, 2 additional technicians, and protected dev time for platform resilience.

**Why today matters:** Without clarity on scope, resources, and governance, we risk duplicating engineering effort, missing revenue delivery dates, and burning out the team. With these decisions made, we unlock significant growth across our verticals.

---

## THE ROOM BRIEF

**Who's here and what they care about:**

| Person | Title | Primary Concern | What They'll Ask |
|--------|-------|-----------------|-----------------|
| **Todd Delano** | Principal Partner | Revenue & profitability | "What does this cost? When do we make money?" |
| **Craig Brown** | Operational Partner | Cost management & execution | "How do we run this without blowing budget?" |
| **Kyle Lasseter** | Partner (ServFlo & Process Matters) | Project velocity & verticals | "Can we scale these four verticals?" |
| **Eric Rosenfeld** | CIO | Long-term platform strategy | "Can we build our own instead of relying on vendors?" |
| **Mark Smith** | CFO | Fiscal responsibility & ROI | "What's the resource plan and payback?" |
| **John Flynn** | Legal | Contracts & compliance | "Are VG gaps closed? What's the labor contractor structure?" |

**The dynamic:** Kyle drives project engagement; Eric champions platform investment; Todd/Craig need ROI clarity; Mark needs budget certainty; John needs legal formalization. Christian needs all of them aligned on governance.

---

## PLATFORM STATUS: CLARITY

### Current Status
- **90% complete** — core data model, API, authentication, audit, multi-tenant isolation
- **Beta launch:** February 28, 2026
- **Production go-live:** March 7–10, 2026
- **Users in beta:** Hatco, G&C, City of LA, internal team

### What Clarity Is
A **Single Source of Truth (SSOT)** for:
- Vendor data ingestion and normalization
- HITL (human-in-the-loop) task management
- Audit trails and compliance reporting
- Cross-project data access and reporting

### Strategic Significance
Clarity is the **foundation for all four verticals:**
- **BPO:** Multi-vendor PO processing (Hatco, G&C, future clients)
- **Manufacturing:** Order and invoice automation
- **Legal:** Case file intake and document processing (Litify, Fendon Law)
- **Medical:** Compliance reporting and data normalization

Without Clarity, each vertical project reinvents the HITL wheel. With Clarity, we scale horizontally across vendors and use cases.

### Delivery Risk: MEDIUM
- **Green:** Core platform is solid; beta testers validate design
- **Yellow:** Three weeks to production go-live is aggressive; no major unknown blockers, but post-launch bug-fix capacity is tight
- **Decision needed:** Post-launch support team (Christian managing + 1 FTE) vs. deferring non-critical issues to Sprint 2

---

## THE KLIPPA PROBLEM: TECHNICAL REALITY CHECK

### Current Situation
Klippa (via SER) is our primary bridge for **automated document processing** (POing, invoices, bills of lading, etc.). It works well for **simple, uniform documents** (single-page POs from major vendors). It **fails at scale** on complex, vendor-specific documents.

### Six Technical Sticking Points

#### 1. **Multiple Templates Required**
- Different vendors use unique PO/invoice layouts: SAP, NetSuite, custom formats
- Maintaining separate Klippa templates per vendor is operationally unsustainable
- **Impact:** We've built templates for ~5 major vendors; scaling to 20+ vendors requires either: (a) Klippa invests in template automation, or (b) we do

#### 2. **Large Document Timeouts**
- Documents with 30+ pages frequently time out mid-processing
- Batch splitting has been attempted; doesn't fully resolve the issue
- **Impact:** Contracts, multi-page invoice packs, and regulatory documents fail silently or drop data

#### 3. **Table Extraction Failures**
- Vendors use wildly different table formats: multi-page tables, notes mixed into product rows, column names that vary by vendor
- Klippa recognizes the text but places extracted data in wrong fields
- **Impact:** Order line items are often wrong; totals don't match; manual review required

#### 4. **OCR Accuracy Gaps**
- Klippa misses clearly visible data: contact names, emails, special delivery instructions
- Text is recognized but not mapped to correct fields
- **Impact:** HITL operators spend 30–40% of time correcting Klippa extraction errors

#### 5. **EU Routing Latency**
- Data routes through EU (Germany) with multiple round trips
- Adds latency (200–500ms per request) and raises U.S. data residency compliance concerns
- **Impact:** Legal, Medical, and regulated BPO clients require U.S. data residency. Klippa routing violates this; we've been using workarounds, but long-term, we need a solution

#### 6. **60% Confidence / Capture Rate**
- Current Klippa reliability: ~60% of extracted data is correct on first pass
- Closing the 40% error gap requires either:
  - **Option A:** Invest in Klippa/SER model training (benefits them, not us; also slow)
  - **Option B:** Build our own secondary validation and correction layer

### The Alternative: Claude AI Secondary Layer

**Current testing (in progress):**
- Claude AI validates Klippa extractions against a simple schema
- Results: **95% confidence** on the same documents that fail at 60% with Klippa alone
- This is a **35-point improvement** — enough to move from "manual review required" to "HITL review exception-based"

**Cost & Timeline:**
- Estimated investment: $20–40K (dev + prompt engineering)
- Timeline: 4–6 weeks to production readiness
- ROI: Reduces HITL operator time by ~30%; unblocks Medical & Legal verticals

### The SER/Klippa Accountability Gap

**The core misunderstanding:**
- Kyle's understanding: The SER/Klippa contract holds them responsible for "document processing to spec" (i.e., correct extraction)
- SER/Klippa's position: They provide "OCR and basic field mapping"; anything more complex is out of scope
- **Result:** Kyle believes we have a delivery guarantee on major verticals; SER/Klippa believes they've delivered the base tool

**Why this matters:**
- BPO vertical depends on reliable extraction; if SER/Klippa won't commit to improving 60% → 90%, we need a plan B
- Legal & Medical verticals cannot launch with EU data residency issues
- We're currently in a grey zone where Kyle is expecting delivery without formal accountability

### The Decision

**For the room:**
- If we invest in the Claude AI secondary layer, we unblock all four verticals and remove dependency on SER/Klippa improvements
- If we don't, we're stuck negotiating with SER/Klippa on scope, timeline, and cost — with execution risk on revenue projects
- **Recommendation:** Commit $30K to Claude secondary layer; set go/no-go at 4-week mark

---

## PLATFORM STRATEGY: THE BRIDGE AND BEYOND

### Immediate: Klippa → Clarity Bridge (Q1 2026)

**What we're building:**
- Klippa processes raw documents (OCR, field mapping)
- Claude AI validates and corrects (secondary layer)
- Clarity SSOT ingests clean, normalized data
- HITL operators review exceptions, update records, audit trail captured

**Result:** Automated end-to-end workflow for BPO, Legal, Medical verticals

### Mid-term: Annotation and Retraining (Q2 2026)

**Opportunity we're sitting on:**
- Every HITL correction is labeled training data
- Annotated corrections feed Claude fine-tuning and model improvement
- As we process more documents, **our own models get smarter**
- This is the moat: We own the vertical-specific training data that Klippa will never see

**Timeline:** 6+ months to measurable improvement; 12+ months to a proprietary model better than Klippa

### Long-term: Build Our Own (Q3+ 2026)

**Eric's vision:** Instead of licensing Klippa, build an in-house document processing model trained on our annotation corpus.

**Why this matters:**
- Klippa charges per-page fees; our volume will eventually make licensing uneconomical
- We control accuracy, latency, data residency, and feature roadmap
- Our annotation corpus (Legal documents, Medical records, BPO orders) becomes a defensible competitive advantage

**Effort:** 2–3 FTE for 6+ months; requires substantial fine-tuning infrastructure and training compute

**Decision needed:** Do we commit to building our own as a 12-month strategic initiative, or remain Klippa-dependent indefinitely?

---

## ACTIVE PROJECT PORTFOLIO

### High-Revenue Projects

#### 1. **POP System** — $105,143.10 / 4 months
- **Client:** Internal use (part of Clarity stack)
- **Status:** In development; feeds Clarity reporting
- **Timeline:** March 2026
- **Owner:** Christian
- **Revenue impact:** Backend for reporting + subscriptions

#### 2. **Hatco: Order Email Processing**
- **Client:** Hatco (industrial supplies)
- **Status:** Pilot complete; scaling to production (Clarity + Klippa bridge)
- **Timeline:** Go-live with Clarity (Mar 7–10)
- **Owner:** Christian
- **Estimated annual revenue:** $18–24K (processing fees)
- **Growth potential:** 10+ similar vendors in industrial supply

#### 3. **G&C: Document Processing**
- **Client:** G&C (construction/logistics)
- **Status:** Pilot complete; ready for Clarity bridge
- **Timeline:** Mar 7–10
- **Owner:** Christian
- **Estimated annual revenue:** $12–18K
- **Growth potential:** Construction and logistics verticals

#### 4. **Litify/Fendon Law: Legal Case Management**
- **Client:** Law firm
- **Status:** SOW in draft; depends on Clarity + Klippa bridge for document intake
- **Timeline:** April 2026 (post-Clarity stabilization)
- **Owner:** Christian
- **Estimated annual revenue:** $36–48K (case intake processing + data normalization)
- **Growth potential:** Large; legal discovery and automation is a $2B+ market

#### 5. **City of LA: Dashboard & Reporting**
- **Client:** City of Los Angeles
- **Status:** Requirements gathering; Clarity is the backend
- **Timeline:** April–May 2026
- **Owner:** Christian
- **Estimated annual revenue:** $24–36K (SaaS model)
- **Growth potential:** Municipal government is sticky; renewal-based revenue

### Medium-Sized Projects

#### 6. **Triangle Design: Web Store & Billing**
- **Client:** Triangle Design (home decor)
- **Status:** Development complete; **ownership of billing logic unresolved**
- **Timeline:** Ready for go-live (pending decision)
- **Owner:** TBD — Christian or Platform team?
- **Estimated annual revenue:** $6–12K (transaction fees)
- **Issue:** Who owns post-launch support, billing updates, tax compliance?

#### 7. **POA/Whitewolf: New Integration Ask**
- **Client:** Partner integrations
- **Status:** Early-stage; scope TBD
- **Timeline:** TBD
- **Owner:** TBD
- **Estimated impact:** Unknown; needs scoping

#### 8. **Presario: B2B Platform**
- **Client:** B2B SaaS play (no SOW yet)
- **Status:** Concept; Kyle engaged but no formal agreement
- **Timeline:** Unknown
- **Owner:** TBD
- **Estimated potential:** High (if real); low execution clarity

### Strategic Initiatives (Lower Priority)

#### 9. **ERP/eCommerce Ecosystem**
- **Scope:** Should we build a vertical-specific ERP or focus on integrations?
- **Status:** Unresolved strategic question
- **Impact:** Affects roadmap for next 12 months
- **Decision needed:** Yes/no/defer to Q3

---

## RESOURCE PICTURE

### Current Team: 9.3 FTE

| Role | FTE | Cost/Month | Notes |
|------|-----|------------|-------|
| **Christian** (Platform Lead) | 1.0 | — | Strategic + day-to-day |
| **Developers** | 4.0 | ~$8K | Core team on Clarity + active projects |
| **PrintDeed dev team** | 3.3 | ~$11,200 | Dedicated to legacy/support |
| **Ops/QA** | 1.0 | ~$2.5K | Testing, deployment, monitoring |
| **TOTAL** | **9.3** | **~$21.7K** | Not including Christian's allocation |

### Utilization & Bottlenecks

**Current state:** 
- Clarity launch (Mar 7–10) is a **hard dependency** for 4 of 9 projects
- Christian is split between Clarity stabilization, project triage, and ops fire-fighting
- PrintDeed team is stable but siloed; no knowledge transfer to main platform
- No dedicated HITL or ops support for post-launch

**Risk:** If Clarity launch slips, all downstream projects slip. If Christian leaves, no one knows the full portfolio.

---

## WHAT CHRISTIAN IS ASKING FOR

### For John Flynn (Legal)

1. **Close VG Merger Gaps** — Formalize any outstanding contracts or equity/IP transfer items
2. **Labor Contractor Structure** — Clarify status of PrintDeed team; are they contractors, employees, or subsidiary?
3. **Timeline:** Complete by March 15 (before Q1 board review)

### For Craig Brown (Operations)

1. **Commit 2 Additional Low-Wage Technicians** (~$2.5K/month total) for:
   - HITL task queueing and operator management
   - Post-launch Clarity support and hotfixes
   - PrintDeed legacy system backlog reduction
2. **Formalize Service Level Agreements (SLAs)** for Clarity uptime (99.5%), incident response (1-hour), and post-launch support window
3. **Budget Impact:** ~$2.5K/month recurring; payback through POP, Hatco, G&C revenue in 60 days

### For Mark Smith (Finance)

1. **Approve resource allocation:**
   - 2 new technicians: $2.5K/month
   - Claude AI secondary layer: $30K one-time
   - Clarity post-launch support team: 0.5 FTE allocation (Christian + 1 technician)
2. **Project revenue tracking:** Establish baseline revenue per project; track actual vs. forecast monthly
3. **3-month review:** Assess ROI at Mar-end; adjust resource plan if needed

### For Todd Delano (Revenue)

1. **Portfolio revenue roadmap:**
   - Mar 2026: $18–24K (Hatco + G&C first month)
   - Apr 2026: +$36–48K (Litify/Fendon Law launch)
   - May 2026: +$24–36K (City of LA launch)
   - **Total Q2 ARR run-rate: $78–108K** (from these 5 projects alone)
2. **2-year vision:** 10+ industrial supply clients (like Hatco), 15+ law firms, 50+ municipalities = $500K+ ARR
3. **Go/no-go decision:** The Klippa/Claude investment is the gate; with it, revenue is predictable; without it, we're stuck

### For Eric Rosenfeld (CIO)

1. **Commit to Platform Strategy:**
   - **Q1:** Klippa → Clarity bridge + Claude secondary layer
   - **Q2:** Annotation infrastructure for fine-tuning
   - **Q3:** Prototype in-house document model (parallel to Klippa, not replacing)
   - **Q4:** Decision on full Klippa replacement by 2027
2. **Infrastructure investment:** Allocate compute budget for model training (GPUs, storage, fine-tuning)
3. **Ask:** Christian becomes the platform PM; Eric leads the long-term architecture

### For Kyle Lasseter (Project Engagement)

1. **Formalize Governance:**
   - All project asks to Christian go through a **weekly sync** with scope, timeline, resource estimate
   - SLA: Christian responds with YES (with dates), NO (with reason), or DEFER (to next sprint)
   - No surprises; no "Oh, I told you about this 3 weeks ago"
2. **Accountability Clarification:** SER/Klippa contract scope; what's their responsibility vs. ours
3. **Clarity on ERP/eCommerce:** Decision this quarter, please. If yes, it changes resource planning

### For All Partners (Collective Ask)

**Governance Decision Matrix:**

| Decision | Owner | Deadline | Impact |
|----------|-------|----------|--------|
| Close VG gaps | John | Mar 15 | Removes legal risk; clarifies org structure |
| Approve 2 technicians | Craig + Mark | Today | Unblocks post-launch support |
| Commit Claude secondary layer | Mark + Eric | Today | Unblocks Legal, Medical, BPO verticals |
| Clarify ERP/eCommerce strategy | Kyle + Eric + Todd | Mar 31 | Affects roadmap and resources |
| Weekly project sync cadence | Kyle + Christian | Today | Prevents surprise asks; improves execution |

---

## CHRISTIAN'S EXPANDED ROLE

### What He's Committing To

**Platform Leadership:**
- Own the Clarity SSOT roadmap and backlog
- Lead post-launch stabilization (Mar 7–May 31)
- Build the annotation infrastructure for model improvement
- Mentor the 2 new technicians; scale from 9.3 → 11.3 FTE

**Project Management:**
- Unified triage and prioritization across all 9 active projects
- Weekly sync with Kyle on new asks (scope, estimate, timeline)
- Monthly revenue and resource tracking (Mark)
- Public quarterly roadmap (for partners + team)

**Vertical Strategy:**
- Own success metrics for each vertical: BPO, Manufacturing, Legal, Medical
- Identify and onboard 2–3 pilot customers per vertical per quarter
- Coordinate with Kyle on partnership/sales approach

**Technical Debt & Scalability:**
- Dedicate 20% of dev time to SSOT platform resilience (not new features)
- Post-launch incident response (first responder for 60 days)
- Quarterly architecture review with Eric

### What He Needs to Make It Real

1. **VG Merger formalization** — Know who reports to him; know the labor structure
2. **Budget certainty** — 2 new technicians committed; Claude secondary layer greenlit
3. **Protected dev time** — 20% allocation to platform (not raided for project fire-fighting)
4. **Weekly sync with Kyle** — Formal project intake; no ad-hoc escalations
5. **Monthly review with Mark & Todd** — Revenue tracking, resource efficiency, ROI
6. **Quarterly sync with Eric** — Platform strategy, long-term roadmap, architecture decisions

### Why This Works

- **Clarity:** Christian has clear authority over Clarity platform and project portfolio
- **Predictability:** Kyle's asks are triaged predictably; no surprises
- **Accountability:** Revenue is tracked; resources are measured; ROI is clear
- **Scalability:** With 2 new technicians, the team can handle 4+ simultaneous projects without burnout
- **Long-term vision:** Eric gets a CTO partner who understands both the business (Kyle's verticals) and the technical strategy (building our own)

---

## RISK FLAGS: WHAT COULD GO WRONG

### If We Don't Commit Resources Today

**Risk 1: Clarity Launch Slips**
- Post-launch support team not allocated → bugs pile up → next projects delay
- **Mitigation:** Approve 2 technicians before Mar 7; have them onboarding now

**Risk 2: Klippa Bottleneck Persists**
- 60% accuracy stays at 60% → HITL operators overwhelmed → BPO/Legal verticals stall
- **Mitigation:** Greenlight Claude secondary layer; set 4-week go/no-go

**Risk 3: SER/Klippa Accountability Unclear**
- Kyle expects delivery; SER/Klippa claims they've delivered → conflict → legal ambiguity
- **Mitigation:** John and Kyle align on contract scope this week; document expectations

**Risk 4: No Governance on Project Asks**
- Kyle keeps adding projects; Christian keeps saying yes → team burns out → quality drops
- **Mitigation:** Weekly sync with formal triage; Christian owns the NO

**Risk 5: ERP/eCommerce Undefined**
- We build point solutions for 9 projects but can't scale to 20+ → architecture debt
- **Mitigation:** Make the decision now; affects every project roadmap

**Risk 6: Triangle Design Ownership Void**
- Launch complete, but who handles billing disputes, tax filings, feature requests?
- **Mitigation:** Assign owner (Christian or Platform team) before launch; document SLA

### If We Do Commit and Execute

**Opportunity:** 
- By May 31, we have 5 revenue-generating projects live, a stable platform, and a repeatable playbook for scaling to 10+ clients per vertical
- By Dec 2026, we've built annotation infrastructure and a prototype in-house model
- By 2027, we're Klippa-independent on document processing; we control our margins

---

## SUMMARY: WHAT WE'RE ASKING THE ROOM TO DECIDE

| Item | Decision | Owner | Timeline |
|------|----------|-------|----------|
| Close VG merger gaps | Approve formalization | John | Mar 15 |
| Approve 2 new technicians | $2.5K/month recurring | Craig + Mark | Today |
| Greenlight Claude secondary layer | $30K one-time investment | Mark + Eric | Today |
| Weekly project sync with Christian | Governance structure | Kyle + Christian | Today |
| Clarify ERP/eCommerce strategy | Build in-house vs. point solutions | Todd + Eric + Kyle | Mar 31 |
| Commit to platform strategy | 12-month arc toward in-house model | Eric | Today |

---

## CHRISTIAN'S CLOSING ASK

> "I'm ready to own the Clarity platform, manage the project portfolio, and lead us toward a proprietary document processing strategy. But I need three things from this room:
> 
> **First:** Formalize what I'm managing. Close the VG gaps, clarify the labor structure, and confirm resource commitment.
> 
> **Second:** Give me governance. Kyle, we need a weekly sync so project asks are predictable and I can say yes or no with clarity, not surprises.
> 
> **Third:** Invest in the platform. The Klippa problem is solvable—Claude AI gets us from 60% to 95% accuracy. That investment unlocks Legal, Medical, and BPO verticals. Without it, we're stuck.
> 
> With these three decisions, I'm confident we deliver $100K+ in new revenue by May 31, and we're on track to build our own in 2027. Let's do this."

---

**Document prepared for All-Hands Tech Meeting, February 23, 2026**  
**Owner:** Christian (Platform Lead)  
**Prepared by:** Briefing Team
