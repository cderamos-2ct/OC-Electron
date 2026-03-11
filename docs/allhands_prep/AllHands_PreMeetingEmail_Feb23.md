# Pre-Meeting Email — All-Hands Tech Meeting
**Send by:** 11:30 AM MST
**To:** Todd Delano, Craig Brown, Kyle Lasseter, Eric Rosenfeld, Mark Smith, John Flynn
**Subject:** Today 2:30 PM — Full Portfolio View + 4 Decisions Needed

---

## EMAIL BODY

Team,

I want to give you a heads-up on what today's meeting is and isn't.

This isn't a status report on any single project. It's a full-scope view of the active portfolio that's been assembled through my engagement with Kyle over the past several weeks — so we can align on priorities, resources, and governance going forward. I want everyone in that room to have the same picture before we make decisions together.

**Here's what I'll be walking through:**

**The Core Platform — Clarity**
Clarity is the foundation everything else is building on. It's our AI-powered document validation and routing platform — multi-tenant, production-grade, currently at 90% completion. Beta is this Friday, February 28. Go-live is March 7–10. This is not a one-client tool — it is shared infrastructure for multiple projects in this portfolio, and that has resource and timeline implications worth discussing together.

**The Bigger Picture — Four Verticals**
Every non-print engagement in this portfolio falls into one of four categories: BPO, Manufacturing, Legal, and Medical. Together they represent a document intelligence platform with genuine enterprise scale. The decisions we make today will determine whether we capture that opportunity or simply execute it for someone else.

**A Direct Conversation About Klippa**
I want to be transparent with this group before we're in the room. We've been running Klippa as our OCR and extraction partner, and it's gotten us this far. But we've surfaced six specific technical limitations that affect our ability to scale:

- Multiple templates required per vendor — unsustainable at volume
- Timeouts on documents over 30 pages — blocking manufacturing and legal use cases
- Inconsistent table extraction — vendor format variance breaks reliable capture
- OCR accuracy gaps at roughly 60% confidence — contact data, special instructions routinely missed
- Document routing through EU servers — latency issues and U.S. data residency exposure for Legal and Medical clients
- A fundamental accountability gap with the SER/Klippa team around what they are and aren't responsible for delivering

For context: our internal testing of Claude-based extraction on the same documents shows 95% confidence. That 35-point gap is the basis for a strategic decision I want to bring to this group — not make unilaterally.

**The Nine Active Projects**
I'll walk through everything Kyle has formally engaged me on, grouped by type: platform integrations feeding into Clarity, active client builds, and business development engagements. Some of these have formal structure. Some don't yet — and that's part of what I need to address today.

**What I Need From This Room**

I'll be direct about my asks:

- **Alignment on scope and sequencing** — I am running multiple engagements in parallel and need this group's direction on priorities when there are resource conflicts. There will be.
- **Governance on how project asks reach me** — Several engagements came to me directly without prior partner discussion. I need a clear intake process before I'm asked to build.
- **A decision on the ERP/eCommerce opportunity** — Kyle has identified real potential customers. This needs to be a group decision, not something I inherit as a build task.
- **A group conversation on Eric's vision for the platform** — I've been thinking through the direction Eric has pointed toward and I believe it deserves a direct conversation in this room.

And personally — I want to be direct about what I'm prepared to take on and what I need to make it real. I'll address that in the meeting.

One thing I want to name upfront: what I'm presenting today is what's been formally surfaced to me. I have every reason to believe there are additional projects in Kyle's pipeline that haven't reached me yet in a structured way. I'm flagging that now so we're not surprised later.

See you at 2:30.

Christian

---

## SEND NOTES

- **Length is intentional** — this group needs enough context to come in prepared, not just primed. The Klippa section especially needs to land before the meeting so it's not a surprise.
- **Do NOT soften the Klippa section** — the 60% vs 95% number is your strongest data point. Let it stand.
- **Optional — separate note to John only:** "John, can we grab 10 minutes before or after to align on the VG formalization item? I want to make sure we're on the same page before I raise it with the group."
- **Optional — separate note to Eric only:** "Eric, I've been thinking through the direction you've been pointing toward and I want to make sure today's conversation gives it the space it deserves. Looking forward to it."
- **Do NOT attach the full briefing doc** — you want them curious and present, not pre-decided.

---

## SUBJECT LINE OPTIONS

1. `Today 2:30 PM — Full Portfolio View + 4 Decisions Needed` ← Recommended
2. `All-Hands 2:30 PM — Portfolio Alignment + Klippa Strategic Decision`
3. `Today's Tech Meeting — What to Expect and What We'll Decide`

---

## FOLLOW-UP EMAIL (send within 24 hours)

**Subject:** `All-Hands Follow-up — Decisions + Next Steps — Feb 23`

Team,

Thank you for the time today. Here's what we committed to:

**Decisions made:**
- [ ] John — VG formalization: [outcome + timeline]
- [ ] Governance intake process: [outcome + owner]
- [ ] Two technicians: [approved/deferred + timeline]
- [ ] ERP/eCommerce: [go / partner / defer]

**Immediate next steps:**
- John + Christian: VG formalization call — [date]
- Governance process: draft by [date]
- Technician recruitment: [owner] by [date]
- ERP/eCommerce: [next step]

Clarity beta is this Friday. I'll send a brief update when it's live.

Christian
