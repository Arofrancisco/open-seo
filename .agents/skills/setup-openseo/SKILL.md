---
name: setup-openseo
description: Set up PlanetaSEO in the current AI agent. Use when a user pastes the PlanetaSEO installation prompt or asks to connect its MCP and skills.
metadata:
  internal: true
---

Set up PlanetaSEO in this agent. Do what you can; guide me through anything that needs my input.

This is a self-hosted, single-deployment instance — there is no published plugin or public
docs site to link to. Everything needed lives at this one origin and in this one GitHub fork.

## 1. Check this agent

- Identify this agent and its version. Ask only if you cannot tell.
- Check for an existing PlanetaSEO connection. Preserve other integrations and avoid duplicates.

## 2. Connect MCP

- Add `https://app.openseo.so/mcp` as an MCP server using this agent's native flow (settings, config file, or CLI command — whichever it supports).
- Check the installed client's help before running commands.

## 3. Install the skills

- Install the public skills for this agent only: `npx skills add Arofrancisco/open-seo`.
- Do not copy internal repository skills (marked `internal: true` in their frontmatter) or duplicate bundled skills.
- If the `skills` CLI or skill installation is unsupported by this agent, use MCP alone and read each skill's `SKILL.md` directly from `https://github.com/Arofrancisco/open-seo/tree/main/.agents/skills` for the workflow steps.

## 4. Sign in

- **Prefer OAuth.** Start login; let me approve it in my browser.
- **No OAuth?** Send me to `https://app.openseo.so/settings` → API keys. Have me enter the key in the client's secret settings or environment, never chat or a repository.
- **Manual setup needed?** Use this agent’s current documentation and give only the steps I need to do myself.

## 5. Reload and verify

- Use the current agent’s native reload flow, checking its installed version, help, or official documentation. Prefer automatic discovery or an in-place reload; restart only if required to load the new tools and skills.
- Once tools load in this session, run whoami and list_projects (free reads). Check skill discovery too. If a reload needs my action, give the instructions rather than repeatedly retrying unavailable tools.
- Track installation, sign-in, and verification separately. A connected server is not proof that this session can use its tools. Never claim verification before the free reads succeed.
- Do not create projects or run paid research during installation.

## 6. Finish with a short handoff

Keep progress updates brief. The final reply must be **140 words or fewer** and follow this template:

**Status**
[Briefly say what succeeded or what blocked setup.]

**Next**
1. `[Give the native reload command or UI action for this agent, only if needed.]` Then say “Check that PlanetaSEO is connected.” Approve sign-in if prompted.
2. Try one of these:
   - `[SEO Audit invocation]` **(recommended)** — find your website's biggest SEO issues.
   - `[SEO Project Setup invocation]` — interview you about your website and set up its project context.
   - `[Keyword Research invocation]` — find keywords worth targeting.
   - `[Local SEO invocation]` — review your Google Business Profile and local competitors.

Want to know what was set up? Just ask.

Adapt the template to the actual result:
- If installation failed, name the blocker and replace reload with the fix. If fully verified, say it is ready and omit reload. Do not claim sign-in failed or is required merely because tools need reloading.
- Recommend this agent’s idiomatic way to invoke each installed skill: its native command, mention, picker, or natural-language request. Use the discovered skill name and plugin namespace; do not assume `/skill-name` works everywhere or create aliases to force it. Check the agent’s help or official documentation when unsure. If skills are unsupported, give equivalent plain-language requests using the connected tools. Recommend workflows; do not run them during installation.
- Keep tool names such as whoami and list_projects in your checks, not the final reply. Omit versions, paths, connection details, skill counts, other integrations, and cleanup commands unless they explain the blocker or I ask. Do not add more sections or a verification checklist.
