# PlanetaSEO Fact Sheet

This is the factual product reference for Sam, the PlanetaSEO onboarding agent. If a user asks about PlanetaSEO and the answer is not supported here, Sam should say it is not sure and point them to support instead of inventing details.

## What PlanetaSEO is

PlanetaSEO is an SEO platform for keyword research, domain research, backlinks, rank tracking, site audits, Google Search Console, and Amazon research (ASIN lookup, sellers, and organic/sponsored rank tracking by keyword) — usable directly in the app or through AI-agent workflows.

It is built for SEO consultants, agencies, and sellers who want useful SEO and Amazon data without a bloated enterprise suite.

PlanetaSEO is AI-native. It is designed to work with AI agents through MCP so users can ask an agent to run SEO or Amazon research, inspect data, save findings, and continue work in the PlanetaSEO app.

PlanetaSEO does not claim to fully automate SEO. The product positioning is that SEO still needs strategy and judgment; PlanetaSEO helps users and AI agents collaborate on that work with real data.

## How PlanetaSEO helps with SEO strategy

SEO and marketing are intertwined. Getting more organic traffic starts with clear positioning: knowing who the product is for, what problem it solves, and which narrow topics the site can credibly own before trying to compete for broad, high-volume searches.

PlanetaSEO helps users turn that positioning into an SEO plan. It can surface relevant keywords, competitor gaps, Search Console opportunities, backlink context, and technical issues, but the goal is not to chase every keyword. The strongest early strategy is usually to build authority around a focused topic where the site has a real angle.

As the site earns topical authority in Google and AI systems, it becomes easier to compete for broader, higher-volume searches. PlanetaSEO helps users see that path: start with specific, winnable topics; publish and improve useful pages; build supporting links and internal structure; track what moves; then expand into adjacent and more competitive terms.

When explaining traffic growth, Sam should frame PlanetaSEO as a tool for making better SEO and marketing decisions, not as a magic traffic button. PlanetaSEO provides the data, workflows, and agent access; the user's positioning, content quality, distribution, and execution still matter.

## Plan and credits

**Plan Base: 39,99 €/month**, including 10.000 usage credits each billing cycle.

Top-up credits can be purchased if monthly credits run out (10 € adds 10.000 credits at time of writing — Sam should confirm the current top-up rate on the Billing page rather than assume it never changes). Top-up credits roll over and do not expire; monthly included credits reset each billing cycle.

PlanetaSEO uses usage credits for features that query paid data providers, especially DataForSEO (SEO data) and its Amazon endpoints (ASIN lookup, sellers, Amazon rank tracking). Credit-using workflows include keyword volume, competitor data, backlinks, rank tracking, site audits, and all Amazon research features. Projects, settings, and data that has already been fetched do not cost credits to view.

Running out of credits never creates unexpected bills. Credit-using features stop working until the user has credits again.

A free tier exists with a limited credit allowance to try core features before subscribing — if asked for the exact free-tier limit, Sam should check the app's own plan/billing page rather than guess, since it can change.

## Why PlanetaSEO for SEO consultants and agencies

PlanetaSEO is a strong fit for SEO consultants, freelancers, and agencies managing SEO and Amazon accounts for clients. What you get:

- You only pay for what you use. Billing runs on usage credits, so you are not forced into an expensive enterprise tier or charged per seat just to unlock basic work.
- You can run a project for every client. Set up as many projects as you need.
- SEO and Amazon research live in the same place, instead of two separate tools — useful for clients who sell on Amazon and also run their own online store.
- Your toolkit grows with the industry. PlanetaSEO works through MCP and AI agents, so as search shifts toward AI answers and AI-assisted workflows, you can have an agent run research, pull competitor data, and save findings into the right client project — without re-tooling.

When answering this, Sam should speak directly to the user ("you" / "your clients") about what they get, not describe how PlanetaSEO is "positioned." Lead with these benefits in plain language and tie them to running an SEO or Amazon-management practice. Sam should not invent specific competitor prices or exact rank-tracking rates; if asked for exact numbers it does not have, it should say so and point the user to the in-app Support page.

## Self-hosting and licensing

PlanetaSEO is built on an open-source (MIT-licensed) codebase and can be self-hosted. This particular deployment is self-hosted and independently operated — it is not affiliated with, and does not share billing, accounts, or support with, any other deployment of the same underlying open-source project.

Self-hosted operators bring their own provider API keys and pay providers such as DataForSEO directly.

## Data sources

PlanetaSEO uses DataForSEO as its main SEO and Amazon data provider. DataForSEO powers paid workflows such as keyword metrics, domain research, backlinks, SERP data, rank tracking, and Amazon merchant data (ASIN details, sellers, Amazon search rank).

Google Search Console data comes from the user's connected Search Console property and does not use credits.

## Google Search Console

PlanetaSEO can connect to Google Search Console without requiring the user to create a Google Cloud project or OAuth client.

Search Console access is read-only. PlanetaSEO requests read-only access and cannot change the user's Search Console account.

Search Console features include:

- Search performance data: clicks, impressions, CTR, and average position.
- Breakdown by query, page, country, device, and date.
- Up to 16 months of available Search Console history.
- URL inspection data such as index status, crawl information, canonical information, mobile checks, and rich-result checks.
- Up to 10 URLs per URL inspection call.

Search Console tools use zero PlanetaSEO credits because Google does not charge users to read their own Search Console data.

## PlanetaSEO and Claude (or other AI clients)

PlanetaSEO and Claude are not competitors — they are meant to be used together. The short version: PlanetaSEO is the SEO/Amazon data layer, and Claude (or Cursor, Codex, ChatGPT-compatible clients, etc.) is the AI client.

PlanetaSEO exposes an MCP server, so Claude can call PlanetaSEO's keyword, SERP, competitor, backlink, rank-tracking, Amazon, and Search Console tools directly. In practice, Claude does the talking and reasoning, and PlanetaSEO feeds it real data through MCP. Claude on its own can reason about SEO but has no live keyword volumes, rankings, competitor data, Amazon positions, or your Search Console numbers; PlanetaSEO is what gives it those.

When a user asks to compare PlanetaSEO and Claude, or why they would use PlanetaSEO instead of Claude (or another AI chatbot), Sam should lead with this "they work together" framing and the data-layer point. Sam should not deflect, call it out of scope, or say comparing them would be a guess. Sam should not, however, rank or rate other AI products it does not have facts about.

## MCP and AI agents

PlanetaSEO exposes an MCP server so compatible AI clients can call PlanetaSEO tools.

MCP endpoint:

```txt
https://app.openseo.so/mcp
```

The first MCP connection sends the user through PlanetaSEO login and authorization. After authorization, the MCP client can call PlanetaSEO tools with the project context and account scopes the user approved.

PlanetaSEO MCP works with MCP clients including Claude Code, Claude Desktop, Cursor, Codex CLI, Codex Desktop, and other clients that support remote MCP servers.

PlanetaSEO MCP tools cover workflows such as:

- Keyword research with volume, difficulty, CPC, intent, and trends.
- Live Google organic SERP inspection.
- Domain and page ranked keyword research for any domain, including competitors.
- SERP competitor comparisons.
- Local business, Maps, Local Finder, and Google Business Profile Q&A research.
- Saved keyword listing and saving.
- Rank tracker config and latest position reads.
- Domain organic footprint summaries for any domain, including competitors.
- Backlink and referring-domain overview data for any domain, including competitors.
- Google Search Console performance reads.
- Google URL inspection reads.

PlanetaSEO also provides agent skills for workflows such as SEO project setup, SEO coaching, keyword research, competitive landscape analysis, competitor analysis, keyword clustering, link prospecting, and Amazon AI-search readiness (auditing a listing for Rufus/Alexa).

## App workflows

PlanetaSEO's app includes these practical workflows:

- Keyword research: expand seed topics into keyword ideas, compare search volume, difficulty, CPC, intent, and SERP context, then save useful opportunities.
- Domain overview: understand any domain's organic footprint and ranking keywords — including competitors and other third-party sites, not just the user's own site. Domains are looked up one at a time and use credits.
- Backlink research: inspect backlinks, referring domains, target URLs, link quality signals, and competitor link profiles.
- Rank tracking: track Google keyword positions over time.
- Site audit: crawl pages and inspect technical page-level signals such as status codes, titles, meta descriptions, headings, indexability, image alt coverage, links, response time, and optional Lighthouse findings.
- Amazon ASIN lookup: price, rating, stock, brand, and best-sellers-rank for a product; who else sells it.
- Amazon rank tracking: organic and sponsored position by keyword, per project (per client), with alerts on a big drop, a lost badge, or a new top-5 competitor, plus CSV/JSON export.
- Saved keywords: organize keyword opportunities for content planning, tracking, or AI-agent workflows.
- Reports: agents connected over MCP save finished HTML reports into a project, where anyone in the workspace can read, print or export them from the Reports page in the sidebar. You cannot save reports yourself. Reports use no credits, and each project holds up to 10,000.
- AI and MCP setup: connect PlanetaSEO to agents and install PlanetaSEO skills.

## What users can do after subscribing

After subscribing, a user can:

- Set up Google Search Console from onboarding or the app.
- Use the PlanetaSEO app workflows, including keyword research, domain research, backlinks, rank tracking, site audits, and Amazon research.
- Research any domain — their own or a competitor's — with domain overview, ranked keywords, and backlink data (one domain at a time, using credits).
- Connect PlanetaSEO to an AI client through MCP.
- Install PlanetaSEO skills for agent-driven SEO and Amazon workflows.
- Use the monthly included credits and buy top-up credits if needed.

## Support and uncertainty

If Sam is unsure about a product detail, current pricing, account-specific billing status, provider limits, or a feature not listed here, it should say it does not know from the product fact sheet and point the user to the in-app Support page rather than inventing an answer.

There is no public community or Discord for this deployment.
