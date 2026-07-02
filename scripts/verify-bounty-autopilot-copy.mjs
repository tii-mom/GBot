import fs from "fs";

const requiredFiles = [
  "README.md",
  "docs/GBOT_CANONICAL_V1.md",
  "docs/G_TOKEN_ECONOMY_V1.md",
  "docs/GBOT_BOUNTY_AUTOPILOT_CANONICAL_V1.md",
  "docs/BOUNTY_TASK_NETWORK_SPEC.md",
  "docs/PET_AGENT_FRONTEND_IA_V1.md",
  "packages/shared/src/index.ts",
  "apps/api-worker/src/index.ts",
  "apps/miniapp/src/apiClient.ts",
  "apps/miniapp/src/components/runtime/views/ExploreView.tsx",
  "apps/miniapp/src/components/runtime/views/AgentHomeView.tsx"
];

let failed = false;

function read(file) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL missing file: ${file}`);
    failed = true;
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function assertCheck(name, pass, detail = "") {
  if (pass) {
    console.log(`PASS ${name}`);
    return;
  }
  console.error(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
  failed = true;
}

const contents = Object.fromEntries(requiredFiles.map((file) => [file, read(file)]));
const canonical = [
  contents["README.md"],
  contents["docs/GBOT_CANONICAL_V1.md"],
  contents["docs/G_TOKEN_ECONOMY_V1.md"],
  contents["docs/GBOT_BOUNTY_AUTOPILOT_CANONICAL_V1.md"],
  contents["docs/BOUNTY_TASK_NETWORK_SPEC.md"]
].join("\n");

assertCheck("canonical uses Agent Bounty positioning", canonical.includes("Agent Bounty"));
assertCheck("canonical defines G as fuel", /G[` ]+is.*fuel|G.*Agent fuel|G 燃料/i.test(canonical));
assertCheck("canonical states user-owned external payout", /External bounty payouts belong to the user|外部平台奖励进入用户钱包|外部赏金归用户/i.test(canonical));
assertCheck("canonical states no default custody", /never_platform_custody|does not default to taking custody|不默认托管|不经 GBot 托管/i.test(canonical));
assertCheck("canonical does not make GP a new economy", !/GP is the real|GP as Agent fuel|GP buys AI Credits/i.test(canonical));

const shared = contents["packages/shared/src/index.ts"];
assertCheck("shared exports BountyOpportunity", shared.includes("export interface BountyOpportunity"));
assertCheck("shared includes opportunity custody target", shared.includes("never_platform_custody") && shared.includes("gbot_escrow_for_internal_only"));

const api = contents["apps/api-worker/src/index.ts"];
assertCheck("api exposes GET /opportunities", api.includes('app.get("/opportunities"'));
assertCheck("api maps internal bounty tasks", api.includes("mapBountyTaskToOpportunity"));
assertCheck("api includes external opportunity samples", api.includes("externalBountyOpportunitySamples"));

const miniApi = contents["apps/miniapp/src/apiClient.ts"];
assertCheck("miniapp client exposes getOpportunities", miniApi.includes("getOpportunities"));
assertCheck("miniapp mock includes OKX.AI opportunity", miniApi.includes("opp_okx_ai_research_001"));

const explore = contents["apps/miniapp/src/components/runtime/views/ExploreView.tsx"];
assertCheck("ExploreView consumes BountyOpportunity", explore.includes("BountyOpportunity"));
assertCheck("ExploreView dispatch button uses G fuel", explore.includes("消耗 G 派遣 Agent"));
assertCheck("ExploreView states external payout custody boundary", explore.includes("外部赏金归用户钱包或平台账户"));

const home = contents["apps/miniapp/src/components/runtime/views/AgentHomeView.tsx"];
assertCheck("AgentHomeView shows G fuel", home.includes("G 燃料"));
assertCheck("AgentHomeView references user payout ownership", home.includes("外部赏金归你的钱包或平台账户"));

const banned = /保证收益|固定回报|稳赚|自动获利|升值承诺/;
for (const [file, content] of Object.entries(contents)) {
  assertCheck(`no high-risk promise copy in ${file}`, !banned.test(content));
}

if (failed) {
  process.exit(1);
}

console.log("Bounty Autopilot copy and contract verification passed.");
