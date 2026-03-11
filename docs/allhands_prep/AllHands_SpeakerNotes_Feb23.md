# All-Hands Speaker Notes & Talking Points
**For Christian** | **Feb 23, 2026, 2:30–3:30 PM MST**

---

## Pre-Meeting Checklist

- [ ] Load slides on laptop; test projector & audio
- [ ] Print 6 copies of 1-page handout summary
- [ ] Have backup USB with PDF of slides
- [ ] Arrive 10 minutes early; position yourself stage-left so you're not blocking slides
- [ ] Water bottle nearby; steady breathing
- [ ] Phone on silent
- [ ] Confirm recording is rolling (if approved)

---

## Opening (2 minutes)
**Goal:** Reset expectations. This is not a status meeting—this is a strategic alignment and decision-making session.

**Script:**
"Thanks for making time on a Sunday afternoon. I know everyone's busy. Here's why I asked for this block: Over the last six months, we've learned some critical things about building at scale with a third-party vendor, and we've proven some bolder ideas about how to build our own platform.

Today is **not** a status update. It's a chance to align on strategy and make some decisions that determine how fast we scale. I'm going to walk you through our nine active projects, surface a real technical problem we've hit with Klippa, show you our solution, and ask for four specific things from this room—one for each of you.

By 3:30, we should have clarity on all of it. If we nail these decisions, we move very fast from here. Fair?"

**Tone:** Conversational, confident, direct. You're not asking permission; you're asking for partnership.

---

## Slide 1: Title / Opening
**No additional notes.** Just confirm slides are loading, make eye contact with the room, and move to Slide 2.

---

## Slide 2: The Portfolio at a Glance
**Goal:** Establish that this is a real business, not a hobby. Nine projects, four verticals, shared infrastructure.

**Script:**
"We're not running a services business—we're running a platform business disguised as services. These nine projects aren't isolated; they all sit on top of one foundation: Clarity, our custom platform.

Let me walk through them:

- **BPO vertical:** City of LA and POP System. City of LA is a pilot that started in December; it's scaling. POP System is the big revenue number—$105K in active work. This is our first real proof of the business model.

- **Manufacturing:** Hatco and G&C. These are smaller, but they're teaching us something critical about what breaks when you use a generic vendor. I'll get into that in a minute.

- **Legal:** Litify and Fendon. Litify is a strategic partnership; we're proving integration. Fendon is market expansion.

- **Medical:** Presario, POA/Whitewolf, and the ERP/eCommerce play. These are biz dev and strategic—higher regulatory lift, higher switching cost, higher margin.

The pattern: Each vertical has unique workflows and compliance requirements, but they all need the same core: document ingestion, extraction, validation, workflow automation. That's Clarity.

Nine projects. Four verticals. One foundation. That's the insight that changes everything."

**Key call-outs:**
- Emphasize POP System ($105K) as proof of revenue model
- Mention Litify as strategic partnership validation
- Plant the idea that medical is a high-margin opportunity

---

## Slide 3: Clarity Platform — The Foundation
**Goal:** Prove we have a real product. Show timeline confidence.

**Script:**
"Clarity is 90% complete. Beta Feb 28. Production go-live Mar 7–10.

Here's what matters: This is not a custom-built project. This is a real, multi-tenant, cloud-native platform. Tech stack: .NET 8 on the backend, Next.js on the frontend, PostgreSQL for data, Redis for caching, AWS ECS Fargate for infrastructure.

Why does that matter? Because it means:
- Multiple customers can use it simultaneously without interference
- We can iterate on features without taking down the platform
- We can scale horizontally without rewriting anything
- We can integrate third-party tools (like extraction services) as swappable modules

Clarity is the skeleton key. Everything we do after March 10 is faster, cheaper, and more reliable because we're not rebuilding the wheel for each client.

This is the moment we move from 'custom development' to 'platform plus configuration.' That shift is worth the investment."

**Key call-outs:**
- Emphasize multi-tenant architecture (scalability)
- Highlight the Feb 28 → Mar 7–10 timeline (confidence)
- Plant the idea of "swappable modules" (for extraction)

---

## Slide 4: The Four Verticals
**Goal:** Show market understanding. Position each vertical as a repeatable playbook.

**Script:**
"These aren't random projects. Each one represents a market segment where document intelligence is table stakes.

**BPO—Back-Office Process Outsourcing.** This is our largest TAM. Think of it as outsourced document processing for big enterprises. We've proven it with City of LA. The workflow is: inbound document → extraction → validation → fulfillment. It's repeatable, it's high-volume, it's margin-friendly.

**Manufacturing—Supply Chain & Order Capture.** Hatco and G&C are proving this right now. The workflow is: POs and invoices come in, we extract line items and tables, validation happens, then fulfillment. The technical challenge here is that tables break a lot of generic extractors. That's where Klippa fails, and where our solution shines.

**Legal—Contract & Compliance Workflow.** Litify is our proof point. The workflow is: contract upload → extraction of clauses, dates, parties → validation → audit trail. This vertical cares about compliance and versioning more than pure speed.

**Medical—ERP/eCommerce Integration.** This is our highest-margin opportunity, but also the highest regulatory lift. Think: patient intake forms, insurance verification, compliance reporting. We haven't sold this yet, but the demand signal is real. Presario and POA/Whitewolf are early conversations.

What they have in common: Vendors who control their own extraction. Vendors who slow down. Vendors who raise prices. What they need: Speed, accuracy, and the ability to iterate on workflows without waiting for a third party. That's our angle."

**Key call-outs:**
- BPO = proven revenue
- Manufacturing = technical proof point (tables)
- Legal = compliance & repeatability
- Medical = high-margin opportunity (not yet proven)
- Unified message: "We own the extraction, we own the speed"

---

## Slide 5: The Klippa Reality — Technical Issues (Critical Slide)
**Goal:** This is the moment you surface the risk honestly. Don't sugarcoat. Make the case for building our own.

**Script:**
"I want to be direct here: Klippa works for simple cases. Single-page documents, clean images, standard formats. But we're not building for simple cases.

Let me walk through the five problems we've hit:

**Problem 1: Multiple templates per vendor.** Klippa forces a one-template-per-vendor model. But real vendors have format variants. One customer might send invoices in three different layouts. Klippa says: 'Create three separate templates.' That's not scalable when you have 50 vendors.

**Problem 2: Page-length timeouts.** Anything over 30 pages times out. Manufacturing spec sheets are 50+ pages. Legal contracts are often 100+ pages. For these use cases, Klippa is a non-starter.

**Problem 3: Table extraction failures.** This is where we're seeing the biggest operational impact. Vendors format tables differently—varying column counts, merged cells, embedded headers. Klippa's table parser fails on maybe 15–20% of complex tables. When that happens, a human has to manually re-enter the data. That's expensive and slow.

**Problem 4: OCR accuracy floor.** Klippa's OCR baseline is around 60% confidence. That works for clean PDFs, but handwriting, poor scans, and non-English text? The confidence drops below 50%. We're doing a lot of human review because of this.

**Problem 5: EU data routing and compliance.** Requests route to EU servers. That adds latency and compliance overhead—GDPR audits, data residency checks. Not a blocker, but it complicates scaling.

And here's the accountability problem: Our contract with Klippa is silent on SLAs. When extraction fails, they point to 'poor image quality.' We're contractually dependent on a vendor who has no obligation to fix these things. They've already told us, 'That's your problem to solve.' We can't build a business on that."

**Pause here. Let that sink in.**

**Key call-outs:**
- Lead with the operational impact (table failures, review burden)
- Emphasize the accountability gap (contract is silent)
- Plant the idea: "We can't build a business on this"

---

## Slide 6: The 60% vs 95% Decision
**Goal:** Show the proof. Make the financial case irrefutable.

**Script:**
"Here's what we've been testing: Claude-based extraction on the same documents that Klippa fails on.

The results: 95% confidence. Let me repeat that—95% confidence on documents where Klippa was at 60%.

Let's talk about what that means:

**Cost:** Klippa is about $0.15 per document, plus human review labor. Claude-based extraction is about $0.08 per document, with minimal review. Over 10,000 documents a month, that's roughly $700 in savings, plus 40 hours of review time freed up.

**Speed:** Klippa iteration takes 4–6 weeks. You request a feature, you hope they build it, you wait. Claude-based extraction: 24 hours. We own the code, we own the tuning.

**Control:** With Klippa, we're passengers. With Claude-based extraction, we're drivers. We can tune the model for specific verticals, adjust prompts, iterate on business logic.

**Time to market:** 3–5x faster client turnaround because extraction is accurate the first time.

This is not a close call. The business case is proven. The question is not 'Can we do this?'—we've already proven we can. The question is 'How fast do we want to do it?'"

**Key call-outs:**
- Lead with the 95% number (confidence)
- Follow with cost savings (hard number: ~$700/month)
- Emphasize speed of iteration (24 hours vs. 4–6 weeks)
- Close with: "How fast do we want to do it?"

---

## Slide 7: The Bridge Strategy
**Goal:** Reduce risk perception. Show a measured, not reckless, transition.

**Script:**
"We're not replacing Klippa overnight. We're running both in parallel, and we're being smart about it.

Here's the phasing:

**Phase 1—Now through April 30:** Klippa stays in production. It's proven, it's operational, customers trust it. Meanwhile, we build our extraction module alongside. Zero production risk.

**Phase 2—May through June:** We launch the annotation partnership. Here's why this is genius: Customers send us documents to label and annotate—work they'd do anyway. That labeled data becomes training data for our Claude-based models. We learn on their dime.

**Phase 3—July and beyond:** We have thousands of real-world training examples. We switch production to Claude-based extraction. Klippa becomes fallback and backup.

The customer perception through all of this? 'They're improving accuracy.' Which is true.

The risk profile? Zero production downtime. Proven fallback. Measured transition.

This is not a rip-and-replace. It's a thoughtful transition that lets us learn while we build."

**Key call-outs:**
- Emphasize the three-phase structure (reduces perception of risk)
- Highlight the annotation partnership (turning customer work into training data)
- Close with: "Zero production downtime"

---

## Slide 8: Platform Strategy & Eric's Vision
**Goal:** Connect the dots to long-term vision. Position this as a platform business, not a services grind.

**Script:**
"Eric and I have talked about this a lot. Clarity is not a one-off project. It's the starting point for a real platform business.

Here's the vision: One data model. One audit trail. One permission system. Every customer sees the same UI. Every customer can configure workflows specific to their vertical. But the underlying infrastructure is ours.

Right now, we're focused on extraction because that's the bottleneck. But the real win is this: Over the next 12 months, we build a stack that every vertical can use, every client can configure, and we can scale predictably.

Extraction is module one. Validation rules engine is module two. Workflow automation is module three. Compliance rules and audit trail is the foundation layer.

What does that buy us? Instead of building custom apps for each client, we build one app with configuration options. That's where the margin is. That's where the scale is.

That's the company we're building."

**Key call-outs:**
- Extraction is module one, not the whole platform
- Multiple modules (validation, workflow, compliance)
- One infrastructure layer, infinite client configurations
- Close with: "That's the company we're building"

---

## Slide 9: Active Project Portfolio
**Goal:** Prove we're managing complexity. Show resource allocation intentionality.

**Script:**
"Let me break down what's actually on our plate right now.

**Revenue drivers:** City of LA and POP System. These are generating cash today. City of LA is a pilot that's scaling well. POP System is the big one—$105K in active work.

**Technical proof points:** Hatco and G&C. These are smaller projects, but they're teaching us everything we need to know about what breaks when you use a generic extractor. Hatco's on beta now. G&C is in build phase.

**Strategic validation:** Litify is our legal integration proof. Fendon is market expansion in legal.

**Business development:** Presario, POA/Whitewolf, and ERP/eCommerce. These are not revenue yet, but they represent expansion vectors. Each one could become a $50K+ annual opportunity.

This is not random project work. This is portfolio management. Two revenue drivers, two technical proofs, two strategic validations, three biz dev opportunities. That's intentional."

**Key call-outs:**
- Emphasize revenue (POP System)
- Highlight technical learning (manufacturing proof)
- Show strategic thinking (portfolio balance)

---

## Slide 10: Resource Picture — Team & Cost
**Goal:** Be transparent about constraints. Make the case for incremental investment.

**Script:**
"We're lean. 9.3 FTE, all via PrintDeed. $11,200 a month all-in.

That means we're efficient. But it also means we're at capacity. Right now, we can run 4–5 active project tracks simultaneously. Any more, and we're context-switching. Any context-switch, and quality drops.

Here's the bottleneck: Every hour a developer spends on a client-specific problem is an hour they're not spending on Clarity or the extraction module. Every client call about data quality eats into platform development time.

I'm not asking for a big team. I'm asking for the right roles. Two more people—low-wage technicians for document QA, client support, and data ops—would free up our developers to focus on the platform and extraction.

That's the ROI play. $3–4K a month to unlock a bunch of dev time. We can find those people in 2 weeks."

**Key call-outs:**
- Emphasize efficiency (lean team, low cost)
- Show the constraint (capacity limit at 4–5 projects)
- Make the ask concrete ($3–4K/month, 2-week timeline)

---

## Slide 11: What We Need to Decide Today (Critical Slide)
**Goal:** This is the moment where you ask explicitly. Be specific. No ambiguity.

**Script:**
"I'm going to be very specific here. We have four asks—one per domain. These are not nice-to-haves. They determine how fast we scale.

**John—I need you to formalize the VG structure.** We need clarity on the legal relationship between Verse Graphics and our division. Who owns what? How do we make decisions? What's the liability structure? IP ownership? I need a written agreement in place by March 1. 30-day timeline. This is the prerequisite for everything else.

**All of you—I need a governance model for how projects get prioritized.** Right now, everyone pulls in different directions. Todd asks for a feature. Craig asks for a cost optimization. Kyle asks for a new client integration. I'm trying to balance all of it, but without a formal process, we're reactive. I'm proposing: Monthly prioritization call. Written project requests. Clear 'Approved / Backlog / Defer' decisions. That prevents chaos and makes the roadmap visible to everyone.

**Mark and Craig—I need two more technicians.** Data QA, document validation, customer support. This is a force multiplier for dev time. Budget: $3K–4K a month. Hiring timeline: 2 weeks. This is the one investment that buys us capacity.

**All of you—We need to decide on medical/eCommerce.** Do we pursue the medical vertical? Presario and POA/Whitewolf are real conversations. But they require different expertise—compliance, healthcare operations, regulatory knowledge. This is a go/no-go decision. If we go, we commit resources and headcount. If we defer, we tell them 'not right now.' But we decide today. No ambiguity.

That's it. Four asks. Four decisions. By 3:30."

**Tone:** Direct, specific, confident. You're not asking permission. You're asking for partnership.

**Key call-outs:**
- John: VG formalization (legal prerequisite)
- All: Governance process (clarity)
- Mark/Craig: +2 technicians ($3–4K/month)
- All: Medical/eCommerce go/no-go (strategic decision)
- Close with: "We decide today"

---

## Slide 12: Christian's Commitment & Expanded Role
**Goal:** Make the ask for expanded scope. Show confidence in your capability.

**Script:**
"If we get these decisions and resources, I'm ready to expand my scope.

Right now, I'm doing technical leadership on extraction, Clarity, and project delivery. I want to add platform roadmap ownership, vendor relationships—Claude, AWS—and vertical market strategy.

What success looks like: Clarity lives Mar 10. Extraction module in beta by Apr 30. Three verticals generating revenue by Jun 30.

Accountability? Monthly updates to Todd and Mark on financials, technical milestones, and resource utilization. I want you to see what's happening. I want transparency.

Timeline: Confirm the expanded role today. Formalize it by March 1.

Here's what I'm asking for: Trust me with the platform strategy. I know what I don't know—compliance, sales, operations—and I'll lean on each of you for that expertise. But I want to own the technical roadmap and the vendor relationships. That's where I can add the most value.

Let's build this together."

**Tone:** Confident, accountable, collaborative. You're stepping up, and you're inviting them to step up with you.

**Key call-outs:**
- Expanded scope: Platform roadmap + vendor relationships + vertical strategy
- Specific timeline (Mar 10, Apr 30, Jun 30)
- Accountability mechanism (monthly updates)
- Collaborative tone ("Let's build this together")

---

## Slide 13: Open Discussion / Q&A (5 minutes)
**Goal:** Create space for hard questions. Don't defend; listen and respond honestly.

**Script:**
"I know I've thrown a lot at you. This is your time. Ask the hard questions—about risk, about cost, about whether this is the right bet.

What keeps you up at night about this plan? What am I missing? What do you need from me to move forward?"

**If you get pushback:**
- **On Klippa risk:** "You're right to worry. That's why we're building the extraction module in parallel. Zero production downtime, proven fallback."
- **On cost ($3–4K/month for technicians):** "The ROI is dev time freed up. Each developer you free up is worth $3–5K in value. This pays for itself in month one."
- **On timeline (Mar 10 go-live):** "We're 90% done. We have 15 days of buffer. If something breaks, we have fallbacks."
- **On medical vertical:** "It's a 50/50 bet. High margin, high regulatory lift. We need to decide if we're going long here or not."

---

## Closing (2–3 minutes)
**Goal:** Summarize decisions, confirm next steps, thank them.

**Script:**
"Here's what I'm walking out with:

[Summarize decisions made and commitments received. Be specific. 'John will formalize VG by March 1. Mark and Craig will start recruitment on the two techs. We'll schedule a governance call for next week.']

We move fast from here. Clarity goes live March 10. Extraction is in beta by end of April. By June, we've proven this across three verticals.

I appreciate your trust and your time. Questions on next steps?"

**If there are no questions, stand in the moment. Don't fill silence. Let them absorb.**

---

## Anticipate These Questions

**Q: What happens if Claude API pricing changes?**
A: Valid concern. We have Claude alternatives (open-source models, other providers). But at current Claude pricing, we're still 40% cheaper than Klippa. We'd have to see a 5x price increase to break even. Unlikely, but we're monitoring.

**Q: What if Klippa sues us for breach?**
A: Our contract with them doesn't prohibit us from building our own extraction. They know we're using them as a vendor, not an exclusive partner. John can speak to the legal specifics, but I'm not worried about this one.

**Q: What if the annotation partnership falls through?**
A: We have a backup. We use synthetic data generation (Claude can create realistic documents) and hire contractors to label documents manually. It's more expensive, but it's a fallback.

**Q: Can we really hire two technicians in 2 weeks?**
A: We'll start recruiting this week. PrintDeed has a pipeline of contract workers. It's not a permanent hire; it's contract-based. We can onboard quickly.

**Q: What's the risk if we don't invest in the platform?**
A: We stay on the services treadmill. Every project is a custom build. We never get leverage. Margins stay thin. We stay small.

---

## Post-Meeting Checklist

- [ ] Send thank-you email to each attendee (personalized)
- [ ] Schedule VG formalization call with John (target: within 3 days)
- [ ] Schedule governance call with all partners (target: within 3 days)
- [ ] Begin recruitment process for two technicians (send PrintDeed pipeline request)
- [ ] Document medical/eCommerce decision (go/no-go) in project memory
- [ ] Update project roadmap to reflect decisions
- [ ] Send weekly update to Todd and Mark on action items

---

**End of Speaker Notes**
