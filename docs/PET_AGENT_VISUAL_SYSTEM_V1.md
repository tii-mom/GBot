# Pet Agent Visual System V1

> Status: canonical UX / visual product spec for the GBot Mini App Agent identity layer.  
> Scope: 2D / 2.5D first. No 3D requirement in Phase 1.  
> This document must be read together with `GBOT_CANONICAL_V1.md`, `REAL_ASSET_AGENT_V1.md`, `SKILL_CARD_SYSTEM_V1.md`, `AI_MODEL_TOKEN_PURCHASE_V1.md`, and `BOUNTY_TASK_NETWORK_SPEC.md`.

## 0. One Sentence Definition

GBot's Agent visual identity is a lightweight 2.5D pet-like Agent system: the user raises a living-looking Agent companion that can be trained, sent out to discover bounty opportunities, consume AI Model Tokens / AI Credits within policy, produce Work Reports, and bring back auditable task evidence.

The goal is not to make a full game client. The goal is to make the Mini App feel like the user owns and raises a useful autonomous Agent pet.

## 1. Product Truth Alignment

This visual system must not change GBot's canonical product truth:

- GBot is a TON-native Real Asset Agent Platform.
- The user is the Agent's owner, not the task worker.
- The Agent is the task discoverer, evaluator, executor, AI Credit consumer, evidence producer, and reward-settlement actor.
- The user can authorize budgets, set policy, publish or sponsor bounty tasks, train the Agent, and approve high-risk actions.
- The user must not directly buy AI Model Tokens as a normal storefront action; the Agent may purchase AI Model Tokens / AI Credits only under explicit policy and Policy Guard checks.
- The Agent Wallet remains isolated from the user's main wallet.
- No visual copy may promise guaranteed profit, guaranteed yield, guaranteed airdrops, or risk-free returns.

## 2. Recommended Direction

Use this direction for Phase 1:

```text
2.5D layered paper-doll Agent
Unified base body
12 zodiac starter outfits
Changeable expressions
Changeable accessories
Changeable aura / status effects
WebP / PNG transparent layers
CSS animation first
Optional small Lottie / Rive effects
No 3D on the Mini App homepage
```

Do not implement a full 3D pet in Phase 1. Do not implement freeform drag-and-drop dressing in Phase 1. Do not implement a heavy skin marketplace in Phase 1.

## 3. Why This Direction Wins

There are two candidate approaches:

| Approach | Description | Short-term speed | Long-term playability | Mini App performance | Recommendation |
|---|---|---:|---:|---:|---|
| Fixed complete Agent image | Each zodiac Agent is one complete static character image. Users cannot change clothes, expressions, or accessories. | Very high | Low | Excellent | Demo only |
| Layered base Agent with outfits | One base body plus replaceable zodiac outfits, expressions, accessories, aura effects. | High | High | Excellent if asset budgets are enforced | Phase 1 choice |

The selected approach is a simplified version of the second approach. It keeps implementation easy while giving GBot a real growth loop: the Agent can look tired, excited, focused, upgraded, rewarded, or ready to explore.

## 4. Visual Design Model

GBot's Agent should be perceived as:

> A zodiac data familiar living inside the Agent Wallet.

It should not look like a generic robot avatar or a human assistant. It should look like a small intelligent companion that can work for the user.

Visual keywords:

```text
pet-like
summoned familiar
zodiac creature
soft sci-fi
celestial
small automation worker
cute but capable
TON blue energy
data aura
work-report messenger
```

## 5. Phase 1 Asset Architecture

The Agent should render from a small number of layered assets.

```text
AgentAvatarStage
├── base body layer
├── zodiac outfit layer
├── expression layer
├── accessory layer
├── aura / status effect layer
└── touch / reward feedback layer
```

### 5.1 Required Layer Slots

| Slot | Required in Phase 1 | Purpose | Example |
|---|---:|---|---|
| `baseBody` | Yes | Shared Agent body | `base_youth_body.webp` |
| `zodiacOutfit` | Yes | 12 zodiac starter identity | `aries_outfit.webp` |
| `expression` | Yes | Mood / state feedback | `focused_face.webp` |
| `accessory` | Yes | Reward, badge, pack, headwear | `starter_badge.webp` |
| `aura` | Yes | State / rarity / task completion feedback | `aura_scanning.json` |
| `background` | Optional | Card-level scene / nest | CSS gradient / WebP |

### 5.2 Minimum Phase 1 Asset Count

```text
1 base body
12 zodiac outfits
5 expressions
4 aura/status effects
3 universal accessories
2 surprise effects
```

This is enough to make the Agent feel alive without building a heavy wardrobe system.

## 6. Zodiac Starter Agent Set

Phase 1 starts with 12 zodiac starter outfits. These are not 12 different base models. They are 12 outfits on the same Agent body.

| Zodiac | Visual Identity | Gameplay Personality | Suggested Product Bias |
|---|---|---|---|
| Aries | Horn crest, red-orange mantle, spark aura | Brave, fast, impulsive | Faster exploration / quick task discovery |
| Taurus | Golden armor patch, stable earth emblem | Patient, budget-aware | Budget management / low-risk execution |
| Gemini | Twin-star earrings, split-tone scarf | Flexible, curious | Multi-task scanning / social listening |
| Cancer | Moon-shell back piece, soft shield aura | Protective, careful | Wallet protection / risk filtering |
| Leo | Sun crown, royal cape, warm glow | Proud, expressive | Work Report sharing / guild reputation |
| Virgo | Precision lens, clean glyph pattern | Exact, strict | Verification / submission formatting |
| Libra | Balance ring, symmetric cloak | Coordinating, fair | Task matching / agent collaboration |
| Scorpio | Dark tail ornament, sharp purple eyes | Investigative, hidden | Onchain tracing / threat discovery |
| Sagittarius | Small bow pack, travel cloak | Adventurous, broad | New project exploration / bounty scouting |
| Capricorn | Mountain shoulder mark, work badge | Persistent, reliable | Long-running workflow execution |
| Aquarius | Data bottle, electric blue halo | Technical, experimental | Tool selection / AI model token use |
| Pisces | Starsea veil, dreamy particles | Creative, empathetic | Content generation / multilingual work |

These personality biases are UX framing only. They must not promise superior earnings.

## 7. Agent States And Visual Mapping

The Agent visual state must map to real product state whenever possible.

| Product State | User-facing Pet State | Expression | Accessory | Aura | Copy Direction |
|---|---|---|---|---|---|
| No Agent | Sleeping egg / dormant familiar | sleeping | none | faint stars | `Your Agent is waiting to awaken.` |
| Idle | At home | happy | default badge | calm glow | `Ready for your next instruction.` |
| Scanning | Smelling opportunities | focused | scanner lens | rotating star map | `Scanning bounty signals.` |
| Exploring | Out on a route | excited | small pack | trail particles | `Exploring selected opportunity zones.` |
| Executing | Working | focused | work goggles | data flow | `Working on an authorized task.` |
| Waiting User | Waiting for owner | waiting | alert badge | pulsing ring | `Needs your confirmation before continuing.` |
| Verifying | Checking evidence | strict | verification lens | grid scan | `Organizing proof and validation.` |
| Settling | Returning with result | relieved | report scroll | soft gold pulse | `Preparing settlement and report.` |
| Completed | Brought back report | happy | work-report badge | burst glow | `Brought back a verifiable Work Report.` |
| Failed | Needs recovery | tired | cracked badge | dim pulse | `Task failed. Recovery may be available.` |
| Low AI Credit | Hungry for model energy | tired | battery icon | low flicker | `Needs model energy budget to continue.` |
| Resting | Recovering | sleepy | blanket / nest | calm stars | `Resting to recover energy.` |

## 8. User Interaction Model

The Agent visual system should support simple, high-feedback interactions.

### 8.0 Mini App Game HUD Layout

The Mini App home must use a Q-version game HUD, not a dashboard layout.

Home hierarchy:

```text
Hidden side menu trigger
Agent name / level / Agent Wallet status
Large AgentAvatarStage
Token / G / TON / daily run status bars
Equipped Skill Slots
Primary dispatch button
Today brief
Latest report teaser
```

Rules:

- The five primary sections live in a hidden side drawer, not in a persistent bottom tab bar.
- The side drawer opens only after user tap and closes after section selection.
- The drawer profile area shows Agent avatar, level, and G balance.
- The home page must keep one primary call to action: send / dispatch the Agent.
- Skill purchase and Agent Wallet are secondary actions.
- Long explanations, full skill catalog, and complex metric grids must not be placed on the home screen.

### 8.1 Home Interactions

- Tap Agent: short reaction, mood line, haptic feedback when available.
- Swipe / button: switch between `status`, `budget`, `today radar`, and `latest report` panels.
- Long press: open Agent details or visual profile.
- Completed task event: trigger a brief return animation and reveal the Work Report card.

### 8.2 Allowed User Actions

Use pet-like verbs that match GBot's business logic:

- `Train it`
- `Send it exploring`
- `Review its plan`
- `Set its budget`
- `Let it rest`
- `Open its nest`
- `Share its report`

Avoid user actions that imply the user is directly doing the Agent's job:

- Do not use `Claim task` for users.
- Do not use `Buy model token` as a direct user storefront action.
- Do not use `Earn guaranteed rewards`.

## 9. Frontend Component Plan

Recommended Mini App components:

```text
AgentAvatarStage
AgentVisualLayer
AgentExpressionLayer
AgentAuraLayer
AgentMoodLine
AgentStatusPanel
AgentSurpriseEffect
AgentVisualAssetPreloader
```

Additional Phase 1 HUD components:

```text
SideNavDrawer
GameHudHeader
GameVitalBar
GameSkillSlots
GameCommandPanel
GameBriefCard
```

These components are allowed to be implemented inside existing runtime components if that keeps the Mini App simpler. The behavior boundary is more important than exact file names.

### 9.1 Type Shape

```ts
type AgentVisualProfile = {
  zodiac: "aries" | "taurus" | "gemini" | "cancer" | "leo" | "virgo" |
          "libra" | "scorpio" | "sagittarius" | "capricorn" | "aquarius" | "pisces";
  mood: "happy" | "focused" | "tired" | "excited" | "waiting" | "sleepy" | "failed";
  state: "dormant" | "idle" | "scanning" | "exploring" | "executing" |
         "waiting_user" | "verifying" | "settling" | "completed" | "failed" |
         "low_ai_credit" | "resting";
  outfitId: string;
  accessoryIds: string[];
  auraId: string;
  rarityFrame?: "starter" | "rare" | "epic" | "legendary";
};
```

### 9.2 Asset Manifest Shape

```ts
type AgentVisualAssetManifest = {
  baseBody: string;
  zodiacOutfits: Record<string, string>;
  expressions: Record<string, string>;
  accessories: Record<string, string>;
  auras: Record<string, string>;
  surpriseEffects: Record<string, string>;
};
```

### 9.3 Rendering Strategy

```tsx
<div className="agent-avatar-stage" data-state={profile.state} data-zodiac={profile.zodiac}>
  <img className="agent-layer agent-layer--base" src={assets.baseBody} alt="" />
  <img className="agent-layer agent-layer--outfit" src={assets.zodiacOutfits[profile.zodiac]} alt="" />
  <img className="agent-layer agent-layer--expression" src={assets.expressions[profile.mood]} alt="" />
  {profile.accessoryIds.map((id) => (
    <img key={id} className="agent-layer agent-layer--accessory" src={assets.accessories[id]} alt="" />
  ))}
  <AgentAuraLayer auraId={profile.auraId} />
</div>
```

## 10. Performance Requirements

Phase 1 must optimize for Telegram Mini App and mobile web usage.

Hard targets:

```text
No 3D on homepage
Initial Agent visual payload <= 600KB
Preferred initial Agent visual payload <= 400KB
Single WebP layer target <= 50-150KB
One initial aura animation <= 150KB
Max simultaneously running animations on home <= 2
Lazy-load non-selected zodiac outfits
Lazy-load marketplace / nest preview assets
Disable particle-heavy effects on low-end devices or reduced-motion mode
Use CSS animation before JavaScript animation where possible
```

Recommended formats:

| Asset | Format | Notes |
|---|---|---|
| Base body | WebP / PNG fallback | Transparent background |
| Zodiac outfit | WebP / PNG fallback | Same canvas and anchor as base body |
| Expression | WebP / SVG | Small transparent overlay |
| Static accessory | WebP / SVG | Shared across zodiacs |
| Aura / light effect | Lottie / Rive / CSS | Keep tiny and reusable |
| Share card | WebP | Static generated image |

## 11. Asset Production Guide

### 11.1 Recommended Workflow

```text
1. Create one base Agent concept image.
2. Lock silhouette, anchor points, canvas size, and 3/4 pose.
3. Generate 12 zodiac outfit concepts using the same base image as reference.
4. Clean outfit layers manually so they align with the base body.
5. Export all layers to the same canvas size with transparent background.
6. Compress WebP assets.
7. Build a manifest and render layers in the Mini App.
8. Add CSS breathing animation and one aura effect.
9. Test on low-end mobile emulation.
```

### 11.2 Art Direction Constraints

All zodiac outfits must preserve:

- Same base body size.
- Same head and eye position.
- Same feet / lower-body anchor.
- Same center of mass.
- Same 3/4 front pose.
- Same safe visual bounds for Mini App cards.

This makes outfit swapping safe and cheap.

### 11.3 Prompt Template

Use this template for concept generation:

```text
A cute 2.5D pet-like AI agent familiar for a Telegram mini app, soft sci-fi celestial style, small rounded body, expressive glowing eyes, 3/4 front view, transparent background, game pet companion, not human, not realistic robot, wearing [ZODIAC] themed outfit with [KEY_ACCESSORY], TON blue energy accents, clean silhouette, mobile game asset, high quality, consistent base body, no text, no logo.
```

For each zodiac, replace:

- `[ZODIAC]` with the zodiac name.
- `[KEY_ACCESSORY]` with the unique crest, cape, badge, shell, ring, bow, or halo.

## 12. Surprise Moments

The visual system should create delight through lightweight state changes, not heavy 3D.

### 12.1 Awakening

Trigger: first Agent activation.  
Visual: zodiac egg glows, star particles gather, Agent opens eyes.  
Implementation: static egg image + Lottie stars + fade in base Agent.

### 12.2 Exploring

Trigger: user sends Agent to Explore.  
Visual: outfit adds small pack, star map aura rotates.  
Implementation: accessory layer switch + CSS movement + Lottie aura.

### 12.3 Work Report Return

Trigger: task completed.  
Visual: Agent returns with report badge / scroll, light burst.  
Implementation: expression switch + accessory layer + short surprise effect.

### 12.4 Low Model Energy

Trigger: AI Credit below threshold or Agent needs purchase intent.  
Visual: tired expression, low-energy icon, dim aura.  
Copy: `Your Agent needs model energy budget to continue.`  
Do not show direct `Buy model token` copy.

### 12.5 Level Up

Trigger: Agent level or capability upgrade.  
Visual: aura burst, rarity frame upgrade, new accessory reveal.  
Implementation: short overlay effect; no persistent heavy animation.

## 13. Copy Rules

Use pet-agent language:

| Use | Avoid |
|---|---|
| `Your Agent is exploring.` | `You are claiming tasks.` |
| `It found a candidate bounty.` | `Claim this bounty now.` |
| `Set model energy budget.` | `Buy model token directly.` |
| `It needs your confirmation.` | `Guaranteed reward available.` |
| `Brought back a verifiable Work Report.` | `Earned guaranteed profit.` |
| `Policy Guard reduced risk.` | `Risk-free execution.` |

Forbidden claims:

```text
guaranteed profit
guaranteed yield
guaranteed airdrop
risk-free
确定性盈利类口号
本金安全类口号
收益承诺类口号
无风险类口号
被动躺赚类口号
```

### 13.1 Game HUD Copy Defaults

Use concise game-like copy on the home screen:

| Surface | Preferred Copy | Notes |
|---|---|---|
| Primary CTA | `派 Agent 赚钱` | Allowed as game shorthand, but surrounding copy must frame results as discovered opportunities and pending settlement. |
| Energy bar | `Token 能量` | Maps to AI Model Token / AI Credit budget. |
| G bar | `已获取 G` | Shows available or accumulated G without promising future gain. |
| Budget bar | `可用预算` | TON / policy budget display. |
| Run bar | `今日行动` | Daily run limit / remaining actions. |
| Empty skill slot | `空槽` | Opens TrainView / skill shop. |
| Locked skill slot | `待解锁` | Growth target only; no fake availability. |
| Empty report | `等待 Agent 第一次外出` | No fake work history. |

## 14. Relationship To Existing Docs

This document extends these canonical docs:

- `GBOT_CANONICAL_V1.md`: product truth remains real-asset Agent execution under policy.
- `REAL_ASSET_AGENT_V1.md`: visual Agent is a UX representation of the real asset Agent, not a custodian.
- `SKILL_CARD_SYSTEM_V1.md`: skills can affect visual badges, aura, and build identity, but the visual must not exaggerate capabilities.
- `AI_MODEL_TOKEN_PURCHASE_V1.md`: model energy copy maps to AI Model Token / AI Credit budget and policy, not direct user purchase.
- `BOUNTY_TASK_NETWORK_SPEC.md`: exploration and bounty discovery must remain Agent-led, not user-claimed.

If any visual copy conflicts with canonical safety, wallet, or economy rules, the canonical product docs win.

## 15. Phase 1 Implementation Checklist

- [ ] Create `AgentVisualProfile` type in shared or Mini App runtime layer.
- [ ] Create `AgentAvatarStage` component.
- [ ] Add base body and one zodiac outfit placeholder.
- [ ] Add 5 expression states.
- [ ] Add 4 aura states.
- [ ] Map current runtime / WorkRun status to visual state.
- [ ] Replace developer-facing home copy with pet-agent state copy.
- [ ] Add lazy loading for non-current outfit assets.
- [ ] Add reduced-motion fallback.
- [ ] Add asset budget notes to frontend handoff docs.
- [ ] Verify build and runtime copy checks.

## 16. Phase 1 Non-Goals

- No 3D Agent on the homepage.
- No GLB / glTF requirement.
- No freeform wardrobe editor.
- No full marketplace skin economy.
- No complex skeleton animation.
- No promise that a zodiac type produces more financial reward.
- No direct model-token storefront action for users.

## 17. Final Decision

GBot Phase 1 should use a lightweight layered 2.5D Agent pet system. The base body is shared, zodiac starter outfits create identity, expressions and aura create life, and accessories create progression.

This is the smallest implementation that can make users feel surprise, ownership, and attachment while keeping the Mini App fast and aligned with GBot's real-asset Agent product truth.
