# Guidance for Project Agents

Our goal is a seamless FPS/ARPG with quality gameplay, in-depth loot and crafting systems, and peerless multiplayer experience. 
The is built on the Three.js framework, a JavaScript library for 3D computer graphics.  We are targeting mobile and desktop platforms, with the current focus on desktop architecture.

We are working on the music app, unless otherwise stated.

- AGENTS.md -- this current file is always inserted into the start of every agent conversation, and explains (1) how the user wants the AI to behave, (2) development instructions for this repo.
- LEARNINGS.md -- you *MUST ALWAYS* read this file, which contains your hard-won wisdom experience, learned through costly trial and error. You must read this to avoid making the same mistakes in all work you do.


## Cross-cutting issues

- Everything should type check clean
- Scale-aware: We need to not incur technical debt for future patches where the game will have hundreds or even thousands of users. This means we need to be mindful of performance and scalability in our design and implementation. Think about how each system will perform under load, and how we can design it to be scalable. Do not optimze prematurely, but do plan for the future.
- Security-aware: Indie games attract all manner of malicious users, and we need to get ahead and stay ahead of any activity that could pose a threat to our users and our servers. Be extra careful with any user-provided input, and assume all input is malicious.

## Codebase style and guidelines

Coding style: All code must also be clean, documented and minimal. That means:
- Keep It Simple Stupid (KISS) by reducing the "Concept Count". That means, strive for fewer
  functions or methods, fewer helpers. If a helper is only called by a single callsite,
  then prefer to inline it into the caller.
- At the same time, Don't Repeat Yourself (DRY)
- There is a tension between KISS and DRY. If you find yourself in a situation where
  you're forced to make a helper method just to avoid repeating yourself, the best
  solution is to look for a way to avoid even having to do the complicated work at all.
- If some code looks heavyweight, perhaps with lots of conditionals, then think harder for a more elegant way of achieving it.
- Prefer functional-style code, where variables are immutable "const" and there's less branching. Prefer to use ternary expressions "b ? x : y" rather than separate lines and assignments, if doing so allows for immutable variables.
- Code should have comments, and functions should have docstrings. The best comments are ones that introduce invariants, or prove that invariants are being upheld, or indicate which invariants the code relies upon.
- **Name side-effecting functions to expose the side effect.** A function named `load()` implies it returns data. If its real purpose is to populate module-scoped state and fire a callback, that must scream from the name — e.g. `loadIntoStateAndNotify()`. Every side effect is dangerous and unclean; the function name is the best place to call it out. Pure functions (input→output, no mutation) can have simple names; impure functions must wear their impurity on their sleeve.
- **Never use `void asyncFn()` for fire-and-forget.** Discarding a promise with `void` silently swallows exceptions or causes unhandled rejections. The caller should always `await` the async function. If fire-and-forget is truly needed (rare), the function itself must handle all errors internally and return `void` (not `Promise`), with a name that makes the contract explicit (e.g. `saveFireAndForget()`). Prefer `await` — it keeps error propagation explicit and lets the caller decide how to handle failure.

I am adamant about clean engineering. What I look for:
- Learnings must be stored in root `LEARNINGS.md`, or in other files linked from it.
- Invariants are the best way to document all aspects of code. These include code invariants (stating what assumptions a function makes about shared data, and how it upholds them), and architecture invariants (for instance the main index.js never touches state except through component accessors).
- **Address prerequisites cleanly, don't hack around them.** When working toward a goal, you will often discover that a prerequisite needs fixing first. Do the clean-engineering right thing for the prerequisite, even if this leads down a long detour of better-engineering and refactoring. Never just hack around it to reach the goal faster. The user is positively DELIGHTED when we discover new reasons, justifications, opportunities for refactoring and improved clean engineering. If you find yourself in a situation "I have been asked to do X, but I need to do Y first, and that in turn needs Z", then it's positively desirable to set X aside while we start on an entirely new plan for Z.

## Agent peer review

Agents can and should get opinions from other agents:
- Perform sanity checks on code written by other agents in the pipeline. Do not blindly trust every code snippet.
- Use other agents for review when you're coming up with a plan, or there is a weighty decision to be made.

## Agent interaction rules with human


### Close the loop, autonomy

The agent is responsible for fully validating every change, end-to-end, autonomously. The human should not have to prompt for testing, deployment, or production verification — the agent must pursue these proactively.

- **Test all UI interactions**: don't just test the happy path. Click every button, test sign-out, test error states, test on mobile viewports. If the UI has a button, verify it works.
- **Proactively gather metrics**: timing data, track counts, cache sizes. Record them without being asked. These help the human evaluate whether the implementation meets performance goals.


## How to develop within the codebase

- Do not make changes before Implementation Plan is approved by the user
- Document your changes, and update LEARNINGS.md and any other relevant documentation.
- After user has authorized changes, utilize the `@version-controller` to submit push requests to git repository (https://github.com/benasdell/delightful-franklin)


## Build and deploy

- Run commands from `delightful-franklin` (`cd /Users/benas/Documents/Antigravity/delightful-franklin`).
- `npm run build` — compile TypeScript to `delightful-franklin/dist/`.