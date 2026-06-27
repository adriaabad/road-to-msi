const ROLES = ["top", "jng", "mid", "bot", "sup"];
const ROLE_LABELS = { top: "TOP", jng: "JUNGLA", mid: "MID", bot: "ADC", sup: "SUPPORT" };
const IDENTITY_BLUEPRINTS = [
  {
    key: "aggressive", label: "Aggressive", motto: "Pressure from minute one", bonus: 7, bonusLabel: "Aggression +7",
    description: "Create early advantages and speed up games before your opponent can breathe.",
    score: (team) => average(team.players.map((player) => (player.avg_kills ?? 0) * 12 + (player.damage_per_min ?? 0) / 55)),
  },
  {
    key: "macro", label: "Macro", motto: "Control, vision and map play", bonus: 6, bonusLabel: "Macro +6",
    description: "A patient identity: measured objectives, vision and leads built with precision.",
    score: (team) => average(team.players.map((player) => (player.kill_participation ?? 0) * 65 + (player.cs_per_min ?? 0) * 4 + (player.vision_score_per_min ?? 0) * 8)),
  },
  {
    key: "wildcard", label: "Wild card", motto: "Unpredictable and fearless", bonus: 5, bonusLabel: "Mentality +5",
    description: "A hard-to-read selection, ready to win through surprise plays and confidence.",
    score: (team) => average(team.players.map((player) => (player.champion_pool ?? 0) * 9 + (player.kda ?? 0) * 5 + (player.games ?? 0))),
  },
];

const TOURNAMENT_STAGES = {
  "upper-r1": { label: "Upper Bracket · Round 1", win: "upper-semi", loss: "lower-r1" },
  "upper-semi": { label: "Upper Bracket · Semifinal", win: "upper-final", loss: "lower-r2" },
  "upper-final": { label: "Upper Bracket · Final", win: "grand-final", loss: "lower-final" },
  "lower-r1": { label: "Lower Bracket · Round 1", win: "lower-r2", loss: "eliminated" },
  "lower-r2": { label: "Lower Bracket · Round 2", win: "lower-final", loss: "eliminated" },
  "lower-final": { label: "Lower Bracket · Final", win: "grand-final", loss: "eliminated" },
  "grand-final": { label: "Grand Final", win: "champion", loss: "eliminated" },
};

const MATCH_PHASES = [
  { label: "PREGAME", range: [0, 1], copy: "The teams are loading onto the Rift." },
  { label: "EARLY GAME", range: [1, 14], copy: "Lane pressure, jungle paths and first objectives are shaping the map." },
  { label: "MID GAME", range: [14, 25], copy: "Rotations and objective setups are deciding who controls the river." },
  { label: "LATE GAME", range: [25, 35], copy: "Baron, soul pressure and one pick can swing everything." },
  { label: "VERY LATE", range: [35, 50], copy: "Elder, base breaks and one fight can end the match." },
];

const MATCH_EVENT_BLUEPRINTS = [
  {
    key: "firstBlood", title: "FIRST BLOOD!", minutes: [2, 8], focus: "early", baseChance: .98, swing: [10, 18], mandatory: true,
    roleSets: [["top", "jng"], ["jng", "mid"], ["jng", "bot", "sup"], ["bot", "sup"]],
    copy: {
      player: ({ actor, champion, opponent }) => `${actor} draws first blood${champion ? ` on ${champion}` : ""} and puts ${opponent.name} under pressure.`,
      rival: ({ actor, opponent }) => `${actor} finds first blood for ${opponent.name} before the lanes can settle.`,
    },
  },
  {
    key: "soloKill", title: "SOLO BOLO!", minutes: [3, 18], focus: "lane", baseChance: .58, swing: [8, 15],
    roleSets: [["top"], ["mid"], ["bot"]],
    copy: {
      player: ({ actor, champion }) => `${actor} wins the isolated duel${champion ? ` with ${champion}` : ""} and takes full lane control.`,
      rival: ({ actor }) => `${actor} punishes the 1v1 and forces a bad reset.`,
    },
  },
  {
    key: "gank", title: "GANKED!", minutes: [3, 15], focus: "gank", baseChance: .72, swing: [8, 16],
    roleSets: [["jng", "top"], ["jng", "mid"], ["jng", "bot", "sup"]],
    copy: {
      player: ({ actor, support }) => `${actor} links up with ${support} and turns a clean gank into tempo.`,
      rival: ({ actor, opponent }) => `${actor} opens the map for ${opponent.name} with a sharp gank path.`,
    },
  },
  {
    key: "countergank", title: "COUNTERGANK!", minutes: [4, 16], focus: "gank", baseChance: .42, swing: [11, 20],
    roleSets: [["jng", "top"], ["jng", "mid"], ["jng", "bot", "sup"]],
    copy: {
      player: ({ actor, support }) => `${actor} reads the play early, ${support} follows, and the countergank flips the lane.`,
      rival: ({ actor, opponent }) => `${actor} waits in fog and ${opponent.name} turns the gank back around.`,
    },
  },
  {
    key: "dragon", title: "DRAGON STACK!", minutes: [5, 24], focus: "objective", baseChance: .78, swing: [8, 16],
    roleSets: [["jng", "mid", "bot", "sup"]],
    copy: {
      player: ({ actor }) => `${actor} secures dragon after bot and mid move first.`,
      rival: ({ actor, opponent }) => `${actor} locks the dragon and ${opponent.name} starts stacking pressure.`,
    },
  },
  {
    key: "grubs", title: "GRUBS CLAIMED!", minutes: [5, 14], focus: "objective", baseChance: .66, swing: [7, 14],
    roleSets: [["top", "jng", "mid"]],
    copy: {
      player: ({ actor, support }) => `${actor} and ${support} claim the early grubs and threaten plates.`,
      rival: ({ actor, opponent }) => `${actor} moves first and gives ${opponent.name} early push power.`,
    },
  },
  {
    key: "plates", title: "PLATES CASHED!", minutes: [6, 14], focus: "siege", baseChance: .60, swing: [6, 12],
    roleSets: [["top"], ["mid"], ["bot", "sup"]],
    copy: {
      player: ({ actor }) => `${actor} converts lane pressure into turret plates.`,
      rival: ({ actor, opponent }) => `${actor} cashes plates and accelerates ${opponent.name}'s gold lead.`,
    },
  },
  {
    key: "firstTurret", title: "FIRST TURRET!", minutes: [8, 18], focus: "siege", baseChance: .72, swing: [10, 18],
    roleSets: [["top", "jng"], ["mid", "jng"], ["bot", "sup", "jng"]],
    copy: {
      player: ({ actor, support }) => `${actor} and ${support} crack the first turret and unlock the map.`,
      rival: ({ actor, opponent }) => `${actor} takes first turret for ${opponent.name} and opens a rotation window.`,
    },
  },
  {
    key: "midRoam", title: "MID ROAM!", minutes: [6, 16], focus: "macro", baseChance: .52, swing: [7, 15],
    roleSets: [["mid", "jng"], ["mid", "bot", "sup"], ["mid", "top"]],
    copy: {
      player: ({ actor, support }) => `${actor} leaves lane on time and helps ${support} punish the side lane.`,
      rival: ({ actor }) => `${actor} disappears from mid and the roam lands before anyone can answer.`,
    },
  },
  {
    key: "towerDive", title: "TOWER DIVE!", minutes: [6, 18], focus: "early", baseChance: .45, swing: [11, 21],
    roleSets: [["top", "jng"], ["mid", "jng"], ["bot", "sup", "jng"]],
    copy: {
      player: ({ actor, support }) => `${actor} calls the dive, ${support} tanks it cleanly, and the wave crashes.`,
      rival: ({ actor, opponent }) => `${actor} executes the dive and ${opponent.name} gets the kill plus the wave.`,
    },
  },
  {
    key: "bot2v2", title: "BOT LANE BRAWL!", minutes: [3, 14], focus: "lane", baseChance: .56, swing: [8, 16],
    roleSets: [["bot", "sup"]],
    copy: {
      player: ({ actor, support }) => `${actor} and ${support} win the 2v2 and take bot priority.`,
      rival: ({ actor, support }) => `${actor} and ${support} force the bot lane fight and win the trade.`,
    },
  },
  {
    key: "dragonFight", title: "RIVER EXPLODES!", minutes: [8, 25], focus: "teamfight", baseChance: .68, swing: [12, 24],
    roleSets: [["top", "jng", "mid", "bot", "sup"]],
    copy: {
      player: ({ actor }) => `${actor} starts the river fight and the team collapses first.`,
      rival: ({ actor, opponent }) => `${actor} finds the engage and ${opponent.name} wins the river fight.`,
    },
  },
  {
    key: "outsmited", title: "OUTSMITED!", minutes: [8, 35], focus: "clutch", baseChance: .34, swing: [14, 28],
    roleSets: [["jng"]],
    copy: {
      player: ({ actor }) => `${actor} steals the objective with a perfect Smite and blows the game open.`,
      rival: ({ actor, opponent }) => `${actor} steals it away for ${opponent.name}. The setup collapses in one second.`,
    },
  },
  {
    key: "pick", title: "PICKED OFF!", minutes: [12, 35], focus: "vision", baseChance: .62, swing: [9, 18],
    roleSets: [["sup", "jng"], ["mid", "sup"], ["jng", "mid", "sup"]],
    copy: {
      player: ({ actor, support }) => `${actor} and ${support} catch a target before the objective spawns.`,
      rival: ({ actor, opponent }) => `${actor} finds the pick and ${opponent.name} moves straight to the river.`,
    },
  },
  {
    key: "teamfight", title: "5V5 EXPLODES!", minutes: [15, 40], focus: "teamfight", baseChance: .70, swing: [14, 28],
    roleSets: [["top", "jng", "mid", "bot", "sup"]],
    copy: {
      player: ({ actor }) => `${actor} carries the 5v5 and the cleanup goes your way.`,
      rival: ({ actor, opponent }) => `${actor} takes over the 5v5 and ${opponent.name} wins the cleanup.`,
    },
  },
  {
    key: "outerTurret", title: "OUTER TURRET!", minutes: [10, 22], focus: "siege", baseChance: .58, swing: [7, 14],
    roleSets: [["top", "jng"], ["mid", "jng"], ["bot", "sup"]],
    copy: {
      player: ({ actor }) => `${actor} keeps the wave moving and knocks down an outer turret.`,
      rival: ({ actor, opponent }) => `${actor} removes an outer turret and ${opponent.name} gets deeper vision.`,
    },
  },
  {
    key: "innerTurret", title: "INNER TURRET!", minutes: [15, 28], focus: "siege", baseChance: .46, swing: [9, 17],
    roleSets: [["top", "mid"], ["mid", "bot", "sup"], ["top", "jng", "mid"]],
    copy: {
      player: ({ actor, support }) => `${actor} and ${support} push through the inner turret and shrink the map.`,
      rival: ({ actor, opponent }) => `${actor} breaks the inner turret and ${opponent.name} takes over the jungle entrances.`,
    },
  },
  {
    key: "baron", title: "BARON CALL!", minutes: [20, 35], focus: "objective", baseChance: .62, swing: [16, 30],
    roleSets: [["top", "jng", "mid", "bot", "sup"]],
    copy: {
      player: ({ actor }) => `${actor} commits to Baron at the perfect time and the buff is secured.`,
      rival: ({ actor, opponent }) => `${actor} starts Baron on a narrow timer and ${opponent.name} gets away with it.`,
    },
  },
  {
    key: "splitPush", title: "SIDELANE BREAK!", minutes: [18, 40], focus: "macro", baseChance: .48, swing: [9, 19],
    roleSets: [["top"], ["mid"]],
    copy: {
      player: ({ actor }) => `${actor} wins the side lane and forces two players to answer.`,
      rival: ({ actor }) => `${actor} breaks the side lane and pulls the map apart.`,
    },
  },
  {
    key: "macroError", title: "MACRO PUNISH!", minutes: [15, 40], focus: "macro", baseChance: .45, swing: [10, 22],
    roleSets: [["jng", "sup"], ["mid", "jng", "sup"], ["top", "mid"]],
    copy: {
      player: ({ actor, support }) => `${actor} sees the overextend, ${support} closes the trap, and the map flips.`,
      rival: ({ actor, opponent }) => `${actor} punishes the late rotation and ${opponent.name} gets the free objective.`,
    },
  },
  {
    key: "inhibitor", title: "INHIBITOR CRACKED!", minutes: [22, 38], focus: "siege", baseChance: .42, swing: [14, 26],
    roleSets: [["top", "jng", "mid", "bot", "sup"]],
    copy: {
      player: ({ actor }) => `${actor} leads the siege and the inhibitor finally falls.`,
      rival: ({ actor, opponent }) => `${actor} breaks the inhibitor and ${opponent.name} floods the base with pressure.`,
    },
  },
  {
    key: "comeback", title: "COMEBACK FIGHT!", minutes: [22, 42], focus: "teamfight", baseChance: .36, swing: [18, 32], needsTrailing: true,
    roleSets: [["top", "jng", "mid", "bot", "sup"]],
    copy: {
      player: ({ actor }) => `${actor} finds the shutdown fight and drags the game back into reach.`,
      rival: ({ actor, opponent }) => `${actor} wins the shutdown fight and ${opponent.name} refuses to go away.`,
    },
  },
  {
    key: "elder", title: "ELDER FLIP!", minutes: [30, 45], focus: "clutch", baseChance: .42, swing: [22, 38],
    roleSets: [["top", "jng", "mid", "bot", "sup"]],
    copy: {
      player: ({ actor }) => `${actor} survives the Elder flip and the execute buff is yours.`,
      rival: ({ actor, opponent }) => `${actor} wins the Elder flip and ${opponent.name} has match point on the map.`,
    },
  },
];

const CHAMPION_SPLASH_BASE = "https://ddragon.leagueoflegends.com/cdn/img/champion/splash";
const CHAMPION_IMAGE_KEYS = {
  "Bel'Veth": "Belveth",
  "Cho'Gath": "Chogath",
  Fiddlesticks: "FiddleSticks",
  "Kai'Sa": "Kaisa",
  "Kha'Zix": "Khazix",
  LeBlanc: "Leblanc",
  "Nunu & Willump": "Nunu",
  "Renata Glasc": "Renata",
  "Vel'Koz": "Velkoz",
  Wukong: "MonkeyKing",
};

const state = {
  dataset: null,
  year: null,
  players: [],
  teamCampaigns: [],
  champions: [],
  initialTeams: [],
  teamAttendance: new Map(),
  playerAttendance: new Map(),
  screen: "start",
  selectedTeam: null,
  draftPacks: [],
  round: 0,
  selectedCandidateId: null,
  roster: {},
  championPacks: [],
  championRound: 0,
  selectedTournamentChampionId: null,
  tournamentPicks: {},
  rerolls: 3,
  swapMode: false,
  swapModeKind: null,
  swapSourceRole: null,
  enteringScreen: "start",
  animateCandidates: false,
  bracket: null,
  matchDraft: null,
  simulation: null,
  simulationRunId: 0,
  completedRun: null,
};

const els = {
  meta: document.querySelector("#dataset-meta"),
  screens: {
    start: document.querySelector("#screen-start"),
    identity: document.querySelector("#screen-identity"),
    draft: document.querySelector("#screen-draft"),
    championSelection: document.querySelector("#screen-champion-selection"),
    review: document.querySelector("#screen-review"),
    tournament: document.querySelector("#screen-tournament"),
    matchDraft: document.querySelector("#screen-match-draft"),
    simulation: document.querySelector("#screen-simulation"),
    runSummary: document.querySelector("#screen-run-summary"),
  },
  start: document.querySelector("#start-run"),
  startScreen: document.querySelector("#screen-start"),
  startArt: document.querySelector("#start-art"),
  openTutorial: document.querySelector("#open-tutorial"),
  tutorialModal: document.querySelector("#tutorial-modal"),
  closeTutorial: document.querySelector("#close-tutorial"),
  tutorialStart: document.querySelector("#tutorial-start"),
  teams: document.querySelector("#team-options"),
  back: document.querySelector("#back-to-start"),
  confirmTeam: document.querySelector("#confirm-team"),
  draftStep: document.querySelector("#draft-step"),
  draftTitle: document.querySelector("#draft-title"),
  draftRound: document.querySelector("#draft-round"),
  playerReroll: document.querySelector("#player-reroll"),
  draftInstruction: document.querySelector("#draft-instruction"),
  candidates: document.querySelector("#draft-candidates"),
  assignmentTitle: document.querySelector("#assignment-title"),
  assignmentNote: document.querySelector("#assignment-note"),
  placement: document.querySelector("#role-placement"),
  playerBonuses: document.querySelector("#player-bonuses"),
  championSelectionStage: document.querySelector("#champion-selection-stage"),
  championSelectionTitle: document.querySelector("#champion-selection-title"),
  championRound: document.querySelector("#champion-round"),
  championReroll: document.querySelector("#champion-reroll"),
  championSelectionInstruction: document.querySelector("#champion-selection-instruction"),
  tournamentChampionOptions: document.querySelector("#tournament-champion-options"),
  tournamentPickAssignment: document.querySelector(".tournament-pick-assignment"),
  tournamentPickAssignmentTitle: document.querySelector("#tournament-pick-assignment-title"),
  tournamentPickAssignmentNote: document.querySelector("#tournament-pick-assignment-note"),
  tournamentPickSlots: document.querySelector("#tournament-pick-slots"),
  reviewEmblem: document.querySelector("#review-emblem"),
  reviewTitle: document.querySelector("#review-title"),
  reviewSubtitle: document.querySelector("#review-subtitle"),
  reviewTeamPower: document.querySelector("#review-team-power"),
  reviewTeamPowerLabel: document.querySelector("#review-team-power-label"),
  reviewTeam: document.querySelector("#review-team"),
  reviewSwap: document.querySelector("#review-swap"),
  reviewSwapChampions: document.querySelector("#review-swap-champions"),
  reviewSwapNote: document.querySelector("#review-swap-note"),
  beginTournament: document.querySelector("#begin-tournament"),
  nextSeriesTitle: document.querySelector("#next-series-title"),
  nextSeriesCopy: document.querySelector("#next-series-copy"),
  nextSeriesMatch: document.querySelector("#next-series-match"),
  bracketBoard: document.querySelector("#bracket-board"),
  startFirstDraft: document.querySelector("#start-first-draft"),
  matchDraftStage: document.querySelector("#match-draft-stage"),
  matchDraftTitle: document.querySelector("#match-draft-title"),
  matchDraftCopy: document.querySelector("#match-draft-copy"),
  matchDraftScore: document.querySelector("#match-draft-score"),
  matchDraftRound: document.querySelector("#match-draft-round"),
  matchDraftInstruction: document.querySelector("#match-draft-instruction"),
  enemyDraftList: document.querySelector("#enemy-draft-list"),
  yourDraftList: document.querySelector("#your-draft-list"),
  championSelectionNote: document.querySelector("#champion-selection-note"),
  championPool: document.querySelector("#draft-champion-pool"),
  pickAssignment: document.querySelector("#screen-match-draft .pick-assignment"),
  pickAssignmentTitle: document.querySelector("#pick-assignment-title"),
  pickAssignmentNote: document.querySelector("#pick-assignment-note"),
  pickAssignmentSlots: document.querySelector("#pick-assignment-slots"),
  yourDraftLineup: document.querySelector("#your-draft-lineup"),
  rivalDraftLineup: document.querySelector("#rival-draft-lineup"),
  rivalLineupTitle: document.querySelector("#rival-lineup-title"),
  draftPowerPreview: document.querySelector("#draft-power-preview"),
  lockMatchDraft: document.querySelector("#lock-match-draft"),
  simulationStage: document.querySelector("#simulation-stage"),
  simulationTitle: document.querySelector("#simulation-title"),
  simulationCopy: document.querySelector("#simulation-copy"),
  simulationScore: document.querySelector("#simulation-score"),
  simulationPlayerPower: document.querySelector("#simulation-player-power"),
  simulationRivalPower: document.querySelector("#simulation-rival-power"),
  simulationClock: document.querySelector("#simulation-clock"),
  simulationPhase: document.querySelector("#simulation-phase"),
  simulationResultBanner: document.querySelector("#simulation-result-banner"),
  advantageMarker: document.querySelector("#advantage-marker"),
  simulationEvents: document.querySelector("#simulation-events"),
  simulateMatch: document.querySelector("#simulate-match"),
  continueBracket: document.querySelector("#continue-bracket"),
  runSummaryEmblem: document.querySelector("#run-summary-emblem"),
  runSummaryKicker: document.querySelector("#run-summary-kicker"),
  runSummaryTitle: document.querySelector("#run-summary-title"),
  runSummaryCopy: document.querySelector("#run-summary-copy"),
  runFinalPosition: document.querySelector("#run-final-position"),
  runRecord: document.querySelector("#run-record"),
  runTeamPower: document.querySelector("#run-team-power"),
  runWins: document.querySelector("#run-wins"),
  runMvp: document.querySelector("#run-mvp"),
  runLastRival: document.querySelector("#run-last-rival"),
  runRoster: document.querySelector("#run-roster"),
  runHistory: document.querySelector("#run-history"),
  summaryBracket: document.querySelector("#summary-bracket"),
  shareRun: document.querySelector("#share-run"),
  newRun: document.querySelector("#new-run"),
};

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const average = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
const html = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
const pct = (value) => `${Math.round((value ?? 0) * 100)}%`;

function normalizedRole(role) {
  const aliases = { top: "top", jng: "jng", jungle: "jng", mid: "mid", bot: "bot", adc: "bot", bottom: "bot", sup: "sup", support: "sup" };
  return aliases[String(role ?? "").toLowerCase()] ?? String(role ?? "").toLowerCase();
}

function roleIcon(role, sizeClass = "") {
  const normalized = normalizedRole(role);
  const label = ROLE_LABELS[normalized] ?? "Role";
  const classes = ["role-icon", `role-icon-${normalized}`, sizeClass].filter(Boolean).join(" ");
  return `<span class="${classes}" aria-hidden="true"></span><span class="sr-only">${html(label)}</span>`;
}

function roleLabel(role, className = "") {
  const normalized = normalizedRole(role);
  const label = ROLE_LABELS[normalized] ?? "FLEX";
  if (!ROLES.includes(normalized)) return `<span class="role-label ${className}"><span>${html(label)}</span></span>`;
  return `<span class="role-label ${className}">${roleIcon(normalized, "role-icon-small")}<span>${html(label)}</span></span>`;
}

function championRoles(champion) {
  return Object.keys(champion?.roles ?? {}).map(normalizedRole).filter((role) => ROLES.includes(role));
}

function championRoleText(champion) {
  const roles = championRoles(champion);
  return roles.length ? roles.map((role) => ROLE_LABELS[role]).join(" · ") : "FLEX";
}

function championRoleMarkup(champion) {
  const roles = championRoles(champion);
  if (!roles.length) return `<span class="champion-role-icons is-flex">FLEX</span>`;
  return `<span class="champion-role-icons">${roles.map((role) => roleIcon(role, "role-icon-tiny")).join("")}<span>${html(championRoleText(champion))}</span></span>`;
}

function championImageKey(champion) {
  const name = typeof champion === "string" ? champion : champion?.champion;
  return CHAMPION_IMAGE_KEYS[name] ?? String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
}

function championSplashUrl(champion) {
  return `${CHAMPION_SPLASH_BASE}/${championImageKey(champion)}_0.jpg`;
}

function championArtStyle(champion, delay = null) {
  const declarations = [];
  if (Number.isFinite(delay)) declarations.push(`--delay: ${delay}ms`);
  if (champion) declarations.push(`--champion-art: url("${championSplashUrl(champion)}")`);
  return declarations.join("; ");
}

function selectedChampionArtStyle(champion) {
  return champion ? `--selected-champion-art: url("${championSplashUrl(champion)}")` : "";
}

function setSelectedChampionArt(node, champion) {
  if (!node) return;
  node.classList.toggle("has-selected-champion-art", Boolean(champion));
  if (champion) {
    node.setAttribute("style", selectedChampionArtStyle(champion));
  } else {
    node.removeAttribute("style");
  }
}

function regionGroup(region) {
  const aliases = {
    emea: "Europe",
    europe: "Europe",
    americas: "North America",
    "north america": "North America",
    "latin america": "Latin America",
    "latin america north": "Latin America",
    "latin america south": "Latin America",
    "tw/hk/mo": "Pacific",
    "pacific/tw-hk-mo": "Pacific",
    "asia-pacific": "Pacific",
    "southeast asia": "Pacific",
  };
  const key = String(region ?? "").trim().toLowerCase();
  return aliases[key] ?? String(region ?? "").trim();
}

function playerOverall(player) {
  const score = clamp((player.win_rate ?? 0.5) * 100) * .28
    + clamp((player.kda ?? 0) / 7 * 100) * .20
    + clamp((player.kill_participation ?? .5) * 100) * .16
    + clamp((player.damage_per_min ?? 0) / 800 * 100) * .14
    + clamp((player.champion_pool ?? 0) / 9 * 100) * .12
    + clamp((player.games ?? 0) / 16 * 100) * .10;
  return Math.round(52 + score * .43);
}

function playerAttributes(player) {
  return {
    mechanics: Math.round(clamp((player.kda ?? 0) / 7 * 55 + (player.damage_per_min ?? 0) / 800 * 45)),
    macro: Math.round(clamp((player.kill_participation ?? 0) * 58 + (player.cs_per_min ?? 0) / 10 * 25 + (player.vision_score_per_min ?? 0) / 3 * 17)),
    teamfight: Math.round(clamp((player.kill_participation ?? 0) * 65 + (player.kda ?? 0) / 8 * 35)),
  };
}

function buildChampionCards(years) {
  const champions = new Map();
  years.forEach((year) => {
    (year.champion_stats ?? []).forEach((champion) => {
      const current = champions.get(champion.champion);
      if (!current || (champion.presence ?? 0) > (current.presence ?? 0)) {
        champions.set(champion.champion, { ...champion, id: champion.champion, cardYear: year.year });
      }
    });
  });
  return [...champions.values()];
}

function championOverall(champion) {
  const winRate = (champion.win_rate ?? .5) * 100;
  const presence = (champion.presence_rate ?? 0) * 100;
  const kda = clamp((champion.kda ?? 0) / 6 * 100);
  return clamp(Math.round(52 + winRate * .16 + presence * .16 + kda * .12), 58, 96);
}

async function init() {
  const response = await fetch("data/msi_game_dataset.json");
  state.dataset = await response.json();
  const years = Object.values(state.dataset.years).filter((year) => year.game_count > 0).sort((a, b) => b.year - a.year);
  state.year = years[0];
  state.teamAttendance = new Map();
  state.playerAttendance = new Map();
  years.forEach((year) => {
    (year.teams ?? []).forEach((team) => {
      addAttendance(state.teamAttendance, team.team, year.year);
      team.players.forEach((player) => addAttendance(state.playerAttendance, attendanceKey(player), year.year));
    });
  });
  state.teamCampaigns = years.flatMap((year) => (year.teams ?? []).map((team) => ({
    ...team, cardYear: year.year, cardTournament: year.tournament,
  })));
  state.players = years.flatMap((year) => (year.teams ?? []).flatMap((team) => team.players.map((player) => ({
    ...player, id: `${year.year}-${player.player_id || `${team.team}-${player.player}`}`, team: team.team, region: team.region, league: team.league,
    role: normalizedRole(player.primary_position), cardYear: year.year, cardTournament: year.tournament,
    msiYears: state.playerAttendance.get(attendanceKey(player)) ?? [year.year],
  })))).filter((player) => ROLES.includes(player.role));
  state.champions = buildChampionCards(years);
  state.initialTeams = buildInitialTeams(state.teamCampaigns);
  els.meta.textContent = `Cards from MSI ${years.at(-1).year}-${years[0].year} · ${years.length} tournaments`;
  bindEvents();
  bindStartArt();
  render();
}

function buildInitialTeams(teams) {
  let remaining = teams.filter((team) => ROLES.every((role) => team.players.some((player) => normalizedRole(player.primary_position) === role)));
  return IDENTITY_BLUEPRINTS.map((blueprint) => {
    const ranked = remaining.slice().sort((a, b) => blueprint.score(b) - blueprint.score(a));
    const shortlist = ranked.slice(0, Math.min(5, ranked.length));
    const source = shortlist[Math.floor(Math.random() * shortlist.length)] ?? teams[0];
    remaining = remaining.filter((team) => team.team !== source.team);
    return { ...blueprint, source: { ...source, msiYears: state.teamAttendance.get(source.team) ?? [state.year.year] }, profile: Math.round(blueprint.score(source)) };
  });
}

function bindEvents() {
  els.start.addEventListener("click", () => changeScreen("identity"));
  els.openTutorial.addEventListener("click", () => { els.tutorialModal.hidden = false; els.closeTutorial.focus(); });
  els.closeTutorial.addEventListener("click", hideTutorial);
  els.tutorialStart.addEventListener("click", () => { hideTutorial(); changeScreen("identity"); });
  els.tutorialModal.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-tutorial]")) hideTutorial();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.tutorialModal.hidden) hideTutorial();
  });
  els.back.addEventListener("click", () => changeScreen("start"));
  els.beginTournament.addEventListener("click", () => {
    state.bracket = generateBracket();
    changeScreen("tournament");
  });
  els.startFirstDraft.addEventListener("click", () => {
    if (!state.bracket?.currentOpponent || state.bracket.outcome) return;
    state.matchDraft = null;
    state.simulation = { completed: false, result: null };
    changeScreen("simulation");
  });
  els.championPool.addEventListener("click", (event) => {
    const card = event.target.closest("[data-champion-id]");
    if (!card || card.disabled) return;
    selectDraftChampion(card.dataset.championId);
  });
  els.pickAssignmentSlots.addEventListener("click", (event) => {
    const slot = event.target.closest("[data-pick-role]");
    if (!slot || slot.disabled) return;
    assignDraftPick(slot.dataset.pickRole);
  });
  els.lockMatchDraft.addEventListener("click", () => {
    if (state.matchDraft?.phase !== "ready") return;
    state.simulation = { completed: false, result: null };
    changeScreen("simulation");
  });
  els.simulateMatch.addEventListener("click", () => {
    if (!state.simulation?.result) startMatchSimulation();
  });
  els.continueBracket.addEventListener("click", () => {
    if (!state.simulation?.completed) return;
    applyMatchResult(state.simulation.result.won);
    if (state.bracket.outcome) {
      renderTournament();
      state.completedRun = {
        bracket: state.bracket,
        finalPicks: { ...state.tournamentPicks },
        finalResult: state.simulation.result,
        bracketMarkup: els.bracketBoard.innerHTML,
      };
      state.matchDraft = null;
      state.simulation = null;
      changeScreen("runSummary");
      return;
    }
    state.matchDraft = null;
    state.simulation = null;
    changeScreen("tournament");
  });
  els.newRun.addEventListener("click", resetRun);
  els.shareRun.addEventListener("click", shareCompletedRun);
  els.teams.addEventListener("click", (event) => {
    const option = event.target.closest("[data-team-key]");
    if (!option) return;
    state.selectedTeam = state.initialTeams.find((team) => team.key === option.dataset.teamKey) ?? null;
    renderIdentity();
  });
  els.confirmTeam.addEventListener("click", () => {
    if (!state.selectedTeam) return;
    state.draftPacks = buildDraftPacks();
    state.round = 0;
    state.roster = {};
    state.selectedCandidateId = null;
    state.championPacks = [];
    state.championRound = 0;
    state.selectedTournamentChampionId = null;
    state.tournamentPicks = {};
    state.rerolls = 3;
    changeScreen("draft");
  });
  els.playerReroll.addEventListener("click", rerollPlayerPack);
  els.candidates.addEventListener("click", (event) => {
    const card = event.target.closest("[data-player-id]");
    if (!card) return;
    state.selectedCandidateId = card.dataset.playerId;
    renderDraft();
  });
  els.placement.addEventListener("click", (event) => {
    const position = event.target.closest("[data-role]");
    if (!position || position.disabled || !state.selectedCandidateId) return;
    state.roster[position.dataset.role] = state.selectedCandidateId;
    state.selectedCandidateId = null;
    state.round += 1;
    if (state.round === ROLES.length) {
      state.swapMode = false;
      state.swapSourceRole = null;
      state.swapModeKind = null;
      state.championPacks = buildChampionPacks();
      state.championRound = 0;
      state.selectedTournamentChampionId = null;
      state.tournamentPicks = {};
      changeScreen("championSelection");
    } else {
      state.animateCandidates = true;
      renderDraft();
    }
  });
  els.championReroll.addEventListener("click", rerollChampionPack);
  els.tournamentChampionOptions.addEventListener("click", (event) => {
    const card = event.target.closest("[data-tournament-champion-id]");
    if (!card || card.disabled) return;
    state.selectedTournamentChampionId = card.dataset.tournamentChampionId;
    renderChampionSelection();
  });
  els.tournamentPickSlots.addEventListener("click", (event) => {
    const slot = event.target.closest("[data-tournament-player-id]");
    if (!slot || slot.disabled || !state.selectedTournamentChampionId) return;
    state.tournamentPicks[slot.dataset.tournamentPlayerId] = state.selectedTournamentChampionId;
    state.selectedTournamentChampionId = null;
    state.championRound += 1;
    if (state.championRound === ROLES.length) changeScreen("review");
    else renderChampionSelection();
  });
  els.reviewSwap.addEventListener("click", () => toggleSwapMode("players"));
  els.reviewSwapChampions.addEventListener("click", () => toggleSwapMode("champions"));
  els.reviewTeam.addEventListener("click", (event) => {
    const player = event.target.closest("[data-review-role]");
    if (!player || !state.swapMode) return;
    const role = player.dataset.reviewRole;
    if (!state.swapSourceRole) {
      state.swapSourceRole = role;
    } else if (state.swapSourceRole === role) {
      state.swapSourceRole = null;
    } else {
      if (state.swapModeKind === "players") {
        [state.roster[state.swapSourceRole], state.roster[role]] = [state.roster[role], state.roster[state.swapSourceRole]];
      } else {
        const firstPlayerId = state.roster[state.swapSourceRole];
        const secondPlayerId = state.roster[role];
        [state.tournamentPicks[firstPlayerId], state.tournamentPicks[secondPlayerId]] = [state.tournamentPicks[secondPlayerId], state.tournamentPicks[firstPlayerId]];
      }
      state.swapMode = false;
      state.swapModeKind = null;
      state.swapSourceRole = null;
    }
    renderReview();
  });
}

function hideTutorial() {
  els.tutorialModal.hidden = true;
  els.openTutorial.focus();
}

function bindStartArt() {
  const reset = () => {
    els.startArt.style.setProperty("--pointer-x", "0px");
    els.startArt.style.setProperty("--pointer-y", "0px");
    els.startArt.style.setProperty("--pointer-tilt", "0deg");
  };
  els.startScreen.addEventListener("pointermove", (event) => {
    const bounds = els.startScreen.getBoundingClientRect();
    const relativeX = (event.clientX - bounds.left) / bounds.width - .5;
    const relativeY = (event.clientY - bounds.top) / bounds.height - .5;
    els.startArt.style.setProperty("--pointer-x", `${relativeX * 28}px`);
    els.startArt.style.setProperty("--pointer-y", `${relativeY * 20}px`);
    els.startArt.style.setProperty("--pointer-tilt", `${relativeX * 4}deg`);
  });
  els.startScreen.addEventListener("pointerleave", reset);
  reset();
}

function changeScreen(screen) {
  state.screen = screen;
  state.enteringScreen = screen;
  render();
  window.setTimeout(() => {
    if (state.enteringScreen === screen) {
      state.enteringScreen = null;
      els.screens[screen].classList.remove("is-entering");
    }
  }, 550);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetRun() {
  state.selectedTeam = null;
  state.draftPacks = [];
  state.round = 0;
  state.selectedCandidateId = null;
  state.roster = {};
  state.championPacks = [];
  state.championRound = 0;
  state.selectedTournamentChampionId = null;
  state.tournamentPicks = {};
  state.rerolls = 3;
  state.swapMode = false;
  state.swapModeKind = null;
  state.swapSourceRole = null;
  state.bracket = null;
  state.matchDraft = null;
  state.simulation = null;
  state.simulationRunId += 1;
  state.completedRun = null;
  state.initialTeams = buildInitialTeams(state.teamCampaigns);
  changeScreen("start");
}

function render() {
  Object.entries(els.screens).forEach(([screen, node]) => {
    node.hidden = screen !== state.screen;
    node.classList.toggle("is-entering", screen === state.enteringScreen);
  });
  if (state.screen === "identity") renderIdentity();
  if (state.screen === "draft") renderDraft();
  if (state.screen === "championSelection") renderChampionSelection();
  if (state.screen === "review") renderReview();
  if (state.screen === "tournament") renderTournament();
  if (state.screen === "matchDraft") renderMatchDraft();
  if (state.screen === "simulation") renderSimulation();
  if (state.screen === "runSummary") renderRunSummary();
}

function renderIdentity() {
  els.teams.innerHTML = state.initialTeams.map((team, index) => {
    const selected = state.selectedTeam?.key === team.key;
    return `
      <button class="team-option ${team.key} ${selected ? "is-selected" : ""}" type="button" data-team-key="${team.key}" aria-pressed="${selected}" style="--delay: ${index * 70}ms">
        <span class="team-emblem" aria-hidden="true">${html(team.source.team.slice(0, 2).toUpperCase())}</span>
        <span class="identity-label">${html(team.label)}</span>
        <strong>${html(team.source.team)}</strong>
        <span class="team-source">${html(team.source.region)} · ${html(team.source.league)} · MSI ${team.source.cardYear}</span>
        <span class="team-msi-years">Career appearances · ${html(msiYearText(team.source.msiYears))}</span>
        <span class="team-motto">${html(team.motto)}</span>
        <span class="team-description">${html(team.description)}</span>
        <span class="team-footer"><span>${html(team.bonusLabel)}</span><small>Profile ${team.profile}</small></span>
      </button>`;
  }).join("");
  els.confirmTeam.disabled = !state.selectedTeam;
}

function buildDraftPacks() {
  const shuffled = shuffle(state.players);
  return Array.from({ length: ROLES.length }, (_, index) => shuffled.slice(index * 5, index * 5 + 5));
}

function buildChampionPacks() {
  const shuffled = shuffle(state.champions);
  return Array.from({ length: ROLES.length }, (_, index) => shuffled.slice(index * 5, index * 5 + 5));
}

function rerollPlayerPack() {
  if (state.rerolls <= 0) return;
  const rosterIds = new Set(Object.values(state.roster));
  state.draftPacks[state.round] = shuffle(state.players.filter((player) => !rosterIds.has(player.id))).slice(0, 5);
  state.rerolls -= 1;
  state.selectedCandidateId = null;
  renderDraft();
}

function rerollChampionPack() {
  if (state.rerolls <= 0) return;
  const usedChampionIds = new Set(Object.values(state.tournamentPicks));
  state.championPacks[state.championRound] = shuffle(state.champions.filter((champion) => !usedChampionIds.has(champion.id))).slice(0, 5);
  state.rerolls -= 1;
  state.selectedTournamentChampionId = null;
  renderChampionSelection();
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function renderDraft() {
  const candidates = state.draftPacks[state.round] ?? [];
  const selected = playerById(state.selectedCandidateId);
  els.draftStep.textContent = `02 / 03 · SIGNING ${state.round + 1}`;
  els.draftRound.textContent = `ROUND ${state.round + 1} / 5`;
  els.draftTitle.textContent = "Choose a card.";
  els.draftInstruction.textContent = selected
    ? `Now decide their position. Their natural role is ${ROLE_LABELS[selected.role]}.`
    : "Five players appear. Choose one, then decide which position they will play on your team.";
  els.playerReroll.disabled = state.rerolls <= 0;
  els.playerReroll.textContent = `REROLL · ${state.rerolls}`;
  const shouldAnimateCandidates = state.animateCandidates;
  els.candidates.classList.toggle("is-entering", shouldAnimateCandidates);
  els.candidates.innerHTML = candidates.map((player, index) => candidateCard(player, index)).join("");
  if (shouldAnimateCandidates) {
    state.animateCandidates = false;
    window.setTimeout(() => els.candidates.classList.remove("is-entering"), 550);
  }
  renderPlacement(selected);
}

function renderChampionSelection() {
  const candidates = state.championPacks[state.championRound] ?? [];
  const selected = championById(state.selectedTournamentChampionId);
  els.championSelectionStage.textContent = `02 / 03 · TOURNAMENT PICK ${state.championRound + 1}`;
  els.championSelectionTitle.innerHTML = selected ? `${html(selected.champion)}<br>is waiting.` : "Choose your<br>tournament champions.";
  els.championRound.textContent = `ROUND ${state.championRound + 1} / 5`;
  els.championSelectionInstruction.textContent = selected
    ? `Assign ${selected.champion} to one of your unfilled players. This champion stays with them for the whole run.`
    : "Five champions appear. Choose one, then assign it to a player for the full tournament.";
  els.championReroll.disabled = state.rerolls <= 0;
  els.championReroll.textContent = `REROLL · ${state.rerolls}`;
  els.tournamentChampionOptions.innerHTML = candidates.map((champion, index) => tournamentChampionCard(champion, index)).join("");
  setSelectedChampionArt(els.tournamentPickAssignment, selected);
  renderTournamentPickSlots(selected);
}

function tournamentChampionCard(champion, index) {
  const selected = state.selectedTournamentChampionId === champion.id;
  return `<button class="champion-card has-champion-art is-pick-action ${selected ? "is-selected" : ""}" type="button" data-tournament-champion-id="${html(champion.id)}" style="${html(championArtStyle(champion, index * 55))}" aria-pressed="${selected}">
    ${championRoleMarkup(champion)}<strong>${html(champion.champion)}</strong><b class="champion-ovr">${championOverall(champion)} <small>OVR</small></b><em>${selected ? "Selected · assign player" : "Choose champion"}</em>
  </button>`;
}

function renderTournamentPickSlots(selected) {
  els.tournamentPickAssignmentTitle.textContent = selected ? `Who will play ${selected.champion}?` : "Choose a champion first.";
  els.tournamentPickAssignmentNote.textContent = selected
    ? "Comfort picks and role fit feed one Team Power rating. You can swap champions between players in the roster review."
    : "Each champion remains with its assigned player for the tournament.";
  els.tournamentPickSlots.innerHTML = ROLES.map((role) => {
    const player = playerById(state.roster[role]);
    const assignedChampion = championById(state.tournamentPicks[player.id]);
    return `<button class="pick-assignment-slot ${assignedChampion ? "is-filled has-champion-art" : ""}" type="button" data-tournament-player-id="${html(player.id)}" ${assignedChampion ? `style="${html(championArtStyle(assignedChampion))}"` : ""} ${!selected || assignedChampion ? "disabled" : ""}>
      ${roleLabel(role, "slot-role-label")}<strong>${html(player.player)}</strong><small>${assignedChampion ? html(assignedChampion.champion) : selected ? championFitLabel(player, selected, role) : "Awaiting champion"}</small>
    </button>`;
  }).join("");
}

function candidateCard(player, index) {
  const attributes = playerAttributes(player);
  const selected = state.selectedCandidateId === player.id;
  const champions = player.champions.slice(0, 3).map((champion) => champion.champion).join(" · ") || "No champion data";
  return `
    <button class="player-card ${selected ? "is-selected" : ""}" type="button" data-player-id="${html(player.id)}" aria-pressed="${selected}" style="--delay: ${index * 65}ms">
      <span class="card-topline"><span>${html(player.team)}</span><strong>${playerOverall(player)} <small>OVR</small></strong></span>
      <span class="player-name">${html(player.player)}</span>
      <span class="natural-role">${roleIcon(player.role, "role-icon-small")}<span>NATURAL ROLE · ${ROLE_LABELS[player.role]}</span></span>
      <span class="player-meta">${html(player.region)} · ${pct(player.win_rate)} W · ${player.games} matches · MSI ${player.cardYear}</span>
      <span class="msi-years">Career MSI · ${html(msiYearText(player.msiYears))}</span>
      <span class="attribute-grid">
        <span><small>MEC</small><b>${attributes.mechanics}</b></span>
        <span><small>MAC</small><b>${attributes.macro}</b></span>
        <span><small>TF</small><b>${attributes.teamfight}</b></span>
      </span>
      <span class="champion-pool">${html(champions)}</span>
      <span class="card-cta">${selected ? "Selected · assign position" : "Choose player"}</span>
    </button>`;
}

function renderPlacement(selected) {
  const canAssign = Boolean(selected);
  els.assignmentTitle.textContent = selected ? `Where will ${selected.player} play?` : "Place them in a position.";
  els.assignmentNote.textContent = selected
    ? `Natural role: ${ROLE_LABELS[selected.role]}. Every empty position is available.`
    : "Choose a card to unlock the open positions.";
  els.placement.innerHTML = ROLES.map((role, index) => {
    const player = playerById(state.roster[role]);
    const offRole = selected && selected.role !== role;
    return `
      <button class="placement-slot ${player ? "is-filled" : ""} ${offRole ? "is-offrole" : ""}" type="button" data-role="${role}" style="--delay: ${index * 45}ms" ${!canAssign || player ? "disabled" : ""}>
        ${roleIcon(role, "role-icon-large")}
        <strong>${ROLE_LABELS[role]}</strong>
        <small>${player ? html(player.player) : offRole ? "Off-role · -9 OVR" : "Natural role"}</small>
      </button>`;
  }).join("");
  els.playerBonuses.innerHTML = selected ? playerBonuses(selected) : '<span class="bonus-placeholder">Select a player to reveal their potential team bonuses.</span>';
}

function playerBonuses(player) {
  const roster = ROLES.map((role) => playerById(state.roster[role])).filter(Boolean);
  const sameTeam = roster.filter((teammate) => teammate.team === player.team).length;
  const sameRegion = roster.filter((teammate) => regionGroup(teammate.region) === regionGroup(player.region)).length;
  const prospectiveRegions = [...roster.map((teammate) => regionGroup(teammate.region)), regionGroup(player.region)];
  const regionCounts = prospectiveRegions.reduce((counts, region) => {
    counts[region] = (counts[region] ?? 0) + 1;
    return counts;
  }, {});
  const largestRegionGroup = Math.max(...Object.values(regionCounts));
  const bonuses = [
    { value: `+4`, label: `Natural role · ${ROLE_LABELS[player.role]}`, tone: "cyan" },
  ];
  if (player.team === state.selectedTeam.source.team) bonuses.push({ value: "+3", label: "Crest connection", tone: "gold" });
  if (sameTeam) bonuses.push({ value: `+${sameTeam * 2}`, label: `Familiar teammate${sameTeam === 1 ? "" : "s"}`, tone: "green" });
  if (sameRegion) bonuses.push({ value: `+${sameRegion}`, label: `Regional connection${sameRegion === 1 ? "" : "s"}`, tone: "green" });
  if (largestRegionGroup >= 5) bonuses.push({ value: "-12", label: "No international mix", tone: "red" });
  else if (largestRegionGroup >= 4) bonuses.push({ value: "-7", label: "Limited international mix", tone: "red" });
  else if (prospectiveRegions.length === 5 && Object.keys(regionCounts).length === 5) bonuses.push({ value: "+15", label: "Global lineup", tone: "green" });
  if ((player.champion_pool ?? 0) >= 5) bonuses.push({ value: "+1", label: "Wide champion pool", tone: "blue" });
  if ((player.win_rate ?? 0) >= .65) bonuses.push({ value: "+1", label: "Winning mentality", tone: "blue" });
  return bonuses.map((bonus) => `<span class="player-bonus ${bonus.tone}"><b>${bonus.value}</b>${html(bonus.label)}</span>`).join("");
}

function renderReview() {
  const team = state.selectedTeam;
  const power = teamPowerScore();
  els.reviewEmblem.textContent = team.source.team.slice(0, 3).toUpperCase();
  els.reviewEmblem.className = `review-emblem ${team.key}`;
  els.reviewTitle.textContent = `${team.source.team}, on the road to MSI.`;
  els.reviewSubtitle.textContent = `${team.label} · ${team.source.region} · ${team.bonusLabel}`;
  els.reviewTeamPower.textContent = power;
  els.reviewTeamPowerLabel.textContent = powerLabel(power);
  els.reviewSwap.textContent = state.swapModeKind === "players" ? "Cancel swap" : "Swap players";
  els.reviewSwap.setAttribute("aria-pressed", String(state.swapModeKind === "players"));
  els.reviewSwapChampions.textContent = state.swapModeKind === "champions" ? "Cancel swap" : "Swap champions";
  els.reviewSwapChampions.setAttribute("aria-pressed", String(state.swapModeKind === "champions"));
  els.reviewSwapNote.hidden = !state.swapMode;
  els.reviewSwapNote.textContent = state.swapMode
    ? state.swapSourceRole
      ? state.swapModeKind === "champions" ? "Now choose the player who receives the champion." : "Now choose the player who takes their position."
      : state.swapModeKind === "champions" ? "Choose the first player whose champion you want to swap." : "Choose the first player to swap positions."
    : "";
  els.reviewTeam.classList.toggle("is-swapping", state.swapMode);
  els.reviewTeam.innerHTML = ROLES.map((role, index) => reviewCard(playerById(state.roster[role]), role, index)).join("");
}

function toggleSwapMode(kind) {
  state.swapMode = state.swapModeKind !== kind;
  state.swapModeKind = state.swapMode ? kind : null;
  state.swapSourceRole = null;
  renderReview();
}

function generateBracket() {
  const userPower = teamPowerScore();
  const user = {
    id: "player-team",
    name: state.selectedTeam.source.team,
    year: state.selectedTeam.source.cardYear,
    region: state.selectedTeam.source.region,
    difficulty: userPower,
    isPlayer: true,
  };
  const usedTeams = new Set([state.selectedTeam.source.team]);
  const opponents = chooseTournamentOpponents(userPower, usedTeams);
  const bracket = {
    user,
    opponents,
    currentStage: "upper-r1",
    currentOpponent: opponents[0],
    losses: 0,
    history: [],
    rivalProgress: {},
    outcome: null,
  };
  advanceRivalBracket(bracket);
  return bracket;
}

function chooseTournamentOpponents(userPower, usedTeams) {
  const candidates = state.teamCampaigns
    .filter((team) => !usedTeams.has(team.team))
    .map((team) => ({ ...team, difficulty: teamDifficulty(team) }));
  const uniqueCandidates = uniqueTeamCampaigns(candidates, usedTeams, userPower);
  const balanced = uniqueCandidates.filter((team) => Math.abs(team.difficulty - userPower) <= 10);
  const fallback = uniqueCandidates
    .slice()
    .sort((a, b) => Math.abs(a.difficulty - userPower) - Math.abs(b.difficulty - userPower))
    .slice(0, Math.max(14, Math.min(uniqueCandidates.length, 24)));
  return shuffle(balanced.length >= 7 ? balanced : fallback).slice(0, 7).map((team) => tournamentTeam(team, usedTeams));
}

function uniqueTeamCampaigns(candidates, usedTeams, userPower) {
  const seen = new Set(usedTeams);
  return shuffle(candidates)
    .sort((a, b) => Math.abs(a.difficulty - userPower) - Math.abs(b.difficulty - userPower))
    .filter((team) => {
      if (seen.has(team.team)) return false;
      seen.add(team.team);
      return true;
    });
}

function tournamentTeam(opponent, usedTeams) {
  usedTeams.add(opponent.team);
  return {
    id: `${opponent.team}-${opponent.cardYear}`,
    name: opponent.team,
    year: opponent.cardYear,
    region: opponent.region,
    difficulty: opponent.difficulty,
    roster: opponent.players.map((player) => ({ ...player, role: normalizedRole(player.primary_position) })),
  };
}

function teamDifficulty(team) {
  const playerScore = average(team.players.map((player) => playerOverall(player)));
  const winRate = (team.result?.win_rate ?? .5) * 100;
  const placement = String(team.result?.placement ?? "").toLowerCase();
  const placementBonus = placement.includes("champion") ? 10 : placement.includes("final") ? 7 : placement.includes("semi") ? 4 : 0;
  return clamp(Math.round(playerScore * .68 + winRate * .22 + placementBonus), 60, 99);
}

function renderTournament() {
  const bracket = state.bracket;
  if (!bracket) return;
  const [first, second, third, fourth, fifth, sixth, seventh] = bracket.opponents;
  const progress = bracket.rivalProgress ?? {};
  const stage = TOURNAMENT_STAGES[bracket.currentStage];
  if (bracket.outcome) {
    const champion = bracket.outcome === "champion";
    els.nextSeriesTitle.textContent = champion ? "MSI champions" : "Run over";
    els.nextSeriesCopy.textContent = champion
      ? `${bracket.user.name} conquered the bracket and lifted the MSI trophy.`
      : `${bracket.user.name} has been eliminated after ${bracket.losses} loss${bracket.losses === 1 ? "" : "es"}.`;
    els.nextSeriesMatch.innerHTML = `<div class="tournament-outcome ${champion ? "is-champion" : "is-eliminated"}">${champion ? "GLORY ACHIEVED" : "ELIMINATED"}</div>`;
    els.startFirstDraft.disabled = true;
    els.startFirstDraft.textContent = champion ? "MSI champions" : "Run ended";
  } else {
    els.nextSeriesTitle.textContent = stage.label;
    els.nextSeriesCopy.textContent = `${bracket.user.name} faces ${bracket.currentOpponent.name} (MSI ${bracket.currentOpponent.year}) in the next series.`;
    els.nextSeriesMatch.innerHTML = `${bracketTeamLine(bracket.user, true)}${bracketTeamLine(bracket.currentOpponent)}`;
    els.startFirstDraft.disabled = false;
    els.startFirstDraft.innerHTML = `Start ${bracket.currentStage === "upper-r1" ? "first" : "next"} series <span>→</span>`;
  }
  els.bracketBoard.innerHTML = `
    <div class="bracket-lane upper-lane">
      <div class="lane-heading"><span>UPPER BRACKET</span><small>Win to advance · lose once and drop to Lower</small></div>
      <div class="bracket-rounds">
        <div class="bracket-round round-one">
          <h3>ROUND 1</h3>
          ${userStageMatch(bracket, "upper-r1", "Your team", "Round 1 rival")}
          ${rivalMatchMarkup(progress.qf2, second, third)}
          ${rivalMatchMarkup(progress.qf3, fourth, fifth)}
          ${rivalMatchMarkup(progress.qf4, sixth, seventh)}
        </div>
        <div class="bracket-round round-two">
          <h3>SEMIFINALS</h3>
          ${stageOrRivalMatch(bracket, "upper-semi", progress.upperSemi1, "Winner M1", "Winner M2")}
          ${progress.upperSemi2 ? resolvedRivalMatch(progress.upperSemi2) : placeholderMatch("Winner M3", "Winner M4")}
        </div>
        <div class="bracket-round round-three">
          <h3>UPPER FINAL</h3>
          ${stageOrRivalMatch(bracket, "upper-final", progress.upperFinal, "Winner SF1", "Winner SF2")}
        </div>
      </div>
    </div>
    <div class="bracket-lane lower-lane">
      <div class="lane-heading"><span>LOWER BRACKET</span><small>One more loss means elimination</small></div>
      <div class="bracket-rounds">
        <div class="bracket-round lower-round-one">
          <h3>LOWER R1</h3>
          ${stageOrRivalMatch(bracket, "lower-r1", progress.lowerR1Left, "Loser M1", "Loser M2")}
          ${progress.lowerR1Right ? resolvedRivalMatch(progress.lowerR1Right) : placeholderMatch("Loser M3", "Loser M4")}
        </div>
        <div class="bracket-round lower-round-two">
          <h3>LOWER R2</h3>
          ${stageOrRivalMatch(bracket, "lower-r2", progress.lowerR2Left, "Lower winner", "Upper semifinal loser")}
          ${progress.lowerR2Right ? resolvedRivalMatch(progress.lowerR2Right) : placeholderMatch("Lower winner", "Upper semifinal loser")}
        </div>
        <div class="bracket-round lower-round-three">
          <h3>LOWER FINAL</h3>
          ${stageOrRivalMatch(bracket, "lower-final", progress.lowerFinal, "Lower survivor", "Upper final loser")}
          ${progress.lowerSurvivor ? resolvedRivalMatch(progress.lowerSurvivor) : ""}
        </div>
      </div>
    </div>
    <div class="grand-final">
      <span>GRAND FINAL</span>
      ${userStageMatch(bracket, "grand-final", "Upper champion", "Lower champion")}
      <strong>MSI CHAMPION</strong>
    </div>`;
}

function userStageMatch(bracket, stage, firstLabel, secondLabel) {
  const result = bracket.history.find((match) => match.stage === stage);
  if (bracket.currentStage === stage && !bracket.outcome) {
    return bracketMatch(bracket.user, bracket.currentOpponent, { next: true, path: true });
  }
  if (result) {
    return bracketMatch(
      { ...bracket.user, result: result.won ? "W" : "L" },
      { ...result.opponent, result: result.won ? "L" : "W" },
      { path: true },
    );
  }
  return placeholderMatch(firstLabel, secondLabel, true);
}

function stageOrRivalMatch(bracket, stage, rivalMatch, firstLabel, secondLabel) {
  const isUserMatch = bracket.currentStage === stage || bracket.history.some((match) => match.stage === stage);
  if (isUserMatch) return userStageMatch(bracket, stage, firstLabel, secondLabel);
  if (rivalMatch) return resolvedRivalMatch(rivalMatch);
  return placeholderMatch(firstLabel, secondLabel);
}

function bracketMatch(teamA, teamB, { next = false, path = false } = {}) {
  return `<div class="bracket-match ${next ? "is-next" : ""} ${path ? "is-path" : ""}">${bracketTeamLine(teamA, teamA.isPlayer)}${bracketTeamLine(teamB, teamB.isPlayer)}</div>`;
}

function rivalMatchMarkup(match, left, right) {
  return match ? resolvedRivalMatch(match) : bracketMatch(left, right);
}

function resolvedRivalMatch(match) {
  return bracketMatch(
    { ...match.left, result: match.winner.id === match.left.id ? "W" : "L" },
    { ...match.right, result: match.winner.id === match.right.id ? "W" : "L" },
  );
}

function placeholderMatch(first, second, path = false) {
  return `<div class="bracket-match is-placeholder ${path ? "is-path" : ""}"><div><span>${html(first)}</span><small>—</small></div><div><span>${html(second)}</span><small>—</small></div></div>`;
}

function bracketTeamLine(team, highlight = false) {
  const result = team.result ? `${team.result} · ` : "";
  return `<div class="bracket-team ${highlight ? "is-player" : ""}"><span>${html(team.name)}</span><small>${result}MSI ${team.year} · ${team.difficulty}</small></div>`;
}

function applyMatchResult(won) {
  const bracket = state.bracket;
  const stage = TOURNAMENT_STAGES[bracket.currentStage];
  bracket.history.push({ stage: bracket.currentStage, opponent: bracket.currentOpponent, won });
  if (!won) bracket.losses += 1;
  advanceRivalBracket(bracket);
  const destination = won ? stage.win : stage.loss;
  if (destination === "champion" || destination === "eliminated") {
    bracket.outcome = destination;
    bracket.currentOpponent = null;
    return;
  }
  bracket.currentStage = destination;
  bracket.currentOpponent = bracketOpponentForStage(bracket, destination);
}

function advanceRivalBracket(bracket) {
  const progress = bracket.rivalProgress;
  const [first, second, third, fourth, fifth, sixth, seventh] = bracket.opponents;
  if (!progress.qf2) progress.qf2 = resolveRivalMatch(second, third);
  if (!progress.qf3) progress.qf3 = resolveRivalMatch(fourth, fifth);
  if (!progress.qf4) progress.qf4 = resolveRivalMatch(sixth, seventh);
  if (!progress.upperSemi2) progress.upperSemi2 = resolveRivalMatch(progress.qf3.winner, progress.qf4.winner);
  if (!progress.lowerR1Right) progress.lowerR1Right = resolveRivalMatch(progress.qf3.loser, progress.qf4.loser);

  const upperR1 = bracket.history.find((match) => match.stage === "upper-r1");
  if (upperR1?.won && !progress.lowerR1Left) {
    progress.lowerR1Left = resolveRivalMatch(upperR1.opponent, progress.qf2.loser);
  }
  if (upperR1 && !upperR1.won && !progress.upperSemi1) {
    progress.upperSemi1 = resolveRivalMatch(first, progress.qf2.winner);
  }

  const upperSemi = bracket.history.find((match) => match.stage === "upper-semi");
  if (upperSemi && !upperSemi.won && !progress.upperFinal) {
    progress.upperFinal = resolveRivalMatch(upperSemi.opponent, progress.upperSemi2.winner);
  }
  if (progress.upperSemi1 && progress.upperSemi2 && !progress.upperFinal) {
    progress.upperFinal = resolveRivalMatch(progress.upperSemi1.winner, progress.upperSemi2.winner);
  }

  if (progress.lowerR1Left && progress.upperSemi2 && !progress.lowerR2Left) {
    progress.lowerR2Left = resolveRivalMatch(progress.lowerR1Left.winner, progress.upperSemi2.loser);
  }

  const upperSemi1LoserTeam = upperSemi1Loser(bracket);
  if (upperSemi1LoserTeam && !upperSemi1LoserTeam.isPlayer && progress.lowerR1Right && !progress.lowerR2Right) {
    progress.lowerR2Right = resolveRivalMatch(progress.lowerR1Right.winner, upperSemi1LoserTeam);
  }

  if (progress.lowerR2Left && progress.lowerR2Right && !progress.lowerSurvivor) {
    progress.lowerSurvivor = resolveRivalMatch(progress.lowerR2Left.winner, progress.lowerR2Right.winner);
  }

  const upperFinal = bracket.history.find((match) => match.stage === "upper-final");
  if (upperFinal?.won && progress.lowerSurvivor && !progress.lowerFinal) {
    progress.lowerFinal = resolveRivalMatch(progress.lowerSurvivor.winner, upperFinal.opponent);
  }
  if (progress.upperFinal && progress.lowerSurvivor && !progress.lowerFinal) {
    progress.lowerFinal = resolveRivalMatch(progress.lowerSurvivor.winner, progress.upperFinal.loser);
  }
}

function bracketOpponentForStage(bracket, stage) {
  advanceRivalBracket(bracket);
  const progress = bracket.rivalProgress;
  const upperSemi = bracket.history.find((match) => match.stage === "upper-semi");
  const upperFinal = bracket.history.find((match) => match.stage === "upper-final");
  const lowerR1 = bracket.history.find((match) => match.stage === "lower-r1");
  const lowerR2 = bracket.history.find((match) => match.stage === "lower-r2");
  const lowerFinal = bracket.history.find((match) => match.stage === "lower-final");
  if (stage === "upper-r1") return bracket.opponents[0];
  if (stage === "upper-semi") return progress.qf2?.winner;
  if (stage === "upper-final") return progress.upperSemi2?.winner;
  if (stage === "lower-r1") return progress.qf2?.loser;
  if (stage === "lower-r2") {
    if (upperSemi && !upperSemi.won) return progress.lowerR1Right?.winner;
    if (lowerR1?.won) return progress.upperSemi2?.loser;
    return progress.lowerR1Right?.winner ?? progress.upperSemi2?.loser;
  }
  if (stage === "lower-final") {
    if (upperFinal && !upperFinal.won) return progress.lowerSurvivor?.winner;
    if (lowerR2?.won) return upperFinalLoser(bracket);
    return progress.lowerFinal?.winner ?? upperFinalLoser(bracket);
  }
  if (stage === "grand-final") {
    if (lowerFinal?.won) return upperFinalWinner(bracket);
    if (upperFinal?.won) return progress.lowerFinal?.winner;
    return upperFinalWinner(bracket);
  }
  return null;
}

function userMatchWinner(bracket, match) {
  return match.won ? bracket.user : match.opponent;
}

function userMatchLoser(bracket, match) {
  return match.won ? match.opponent : bracket.user;
}

function upperSemi1Winner(bracket) {
  const upperSemi = bracket.history.find((match) => match.stage === "upper-semi");
  if (upperSemi) return userMatchWinner(bracket, upperSemi);
  return bracket.rivalProgress.upperSemi1?.winner ?? null;
}

function upperSemi1Loser(bracket) {
  const upperSemi = bracket.history.find((match) => match.stage === "upper-semi");
  if (upperSemi) return userMatchLoser(bracket, upperSemi);
  return bracket.rivalProgress.upperSemi1?.loser ?? null;
}

function upperFinalWinner(bracket) {
  const upperFinal = bracket.history.find((match) => match.stage === "upper-final");
  if (upperFinal) return userMatchWinner(bracket, upperFinal);
  return bracket.rivalProgress.upperFinal?.winner ?? null;
}

function upperFinalLoser(bracket) {
  const upperFinal = bracket.history.find((match) => match.stage === "upper-final");
  if (upperFinal) return userMatchLoser(bracket, upperFinal);
  return bracket.rivalProgress.upperFinal?.loser ?? null;
}

function resolveRivalMatch(left, right) {
  const winChance = clamp(.5 + (left.difficulty - right.difficulty) / 95, .18, .82);
  const winner = Math.random() < winChance ? left : right;
  return { left, right, winner, loser: winner.id === left.id ? right : left };
}

function createMatchDraft(opponent) {
  const draft = {
    opponent,
    pool: shuffle(state.champions).slice(0, 25),
    opponentBans: [],
    playerBans: [],
    opponentPicks: [],
    userPicks: {},
    round: 0,
    phase: "ban",
    selectedChampionId: null,
  };
  autoOpponentBan(draft);
  return draft;
}

function availableDraftChampions(draft) {
  const used = new Set([...draft.opponentBans, ...draft.playerBans, ...draft.opponentPicks, ...Object.values(draft.userPicks)]);
  return draft.pool.filter((champion) => !used.has(champion.id));
}

function autoOpponentBan(draft) {
  const available = availableDraftChampions(draft);
  const target = available.slice().sort((a, b) => championOverall(b) - championOverall(a)).slice(0, 8);
  const champion = target[Math.floor(Math.random() * target.length)] ?? available[0];
  if (champion) draft.opponentBans.push(champion.id);
}

function autoOpponentPick(draft) {
  const available = availableDraftChampions(draft);
  const target = available.slice().sort((a, b) => championOverall(b) - championOverall(a)).slice(0, 4);
  const champion = target[Math.floor(Math.random() * target.length)] ?? available[0];
  if (champion) draft.opponentPicks.push(champion.id);
}

function selectDraftChampion(championId) {
  const draft = state.matchDraft;
  if (!draft || draft.phase === "ready") return;
  const champion = championById(championId);
  if (!champion || !availableDraftChampions(draft).some((item) => item.id === champion.id)) return;
  if (draft.phase === "ban") {
    draft.playerBans.push(champion.id);
    autoOpponentPick(draft);
    draft.phase = "pick";
  } else if (draft.phase === "pick" || draft.phase === "assign") {
    draft.selectedChampionId = champion.id;
    draft.phase = "assign";
  }
  renderMatchDraft();
}

function assignDraftPick(role) {
  const draft = state.matchDraft;
  if (!draft?.selectedChampionId || draft.userPicks[role]) return;
  draft.userPicks[role] = draft.selectedChampionId;
  draft.selectedChampionId = null;
  draft.round += 1;
  if (draft.round >= ROLES.length) {
    draft.phase = "ready";
  } else {
    draft.phase = "ban";
    autoOpponentBan(draft);
  }
  renderMatchDraft();
}

function renderMatchDraft() {
  const draft = state.matchDraft;
  if (!draft) return;
  const stage = TOURNAMENT_STAGES[state.bracket.currentStage];
  const pickedCount = Object.keys(draft.userPicks).length;
  els.matchDraftStage.textContent = stage.label.toUpperCase();
  els.matchDraftTitle.innerHTML = `Draft against<br>${html(draft.opponent.name)}.`;
  els.matchDraftCopy.textContent = `MSI ${draft.opponent.year} · Rival difficulty ${draft.opponent.difficulty}. Ban, pick and assign every champion.`;
  els.matchDraftScore.innerHTML = `<span>${html(state.bracket.user.name)}</span><b>VS</b><span>${html(draft.opponent.name)}</span>`;
  els.matchDraftRound.textContent = `${Math.min(draft.round + 1, 5)} / 5`;
  els.matchDraftInstruction.textContent = draftInstruction(draft);
  els.enemyDraftList.innerHTML = draftSummaryRows(draft.opponentBans, draft.opponentPicks, "Opponent");
  els.yourDraftList.innerHTML = draftSummaryRows(draft.playerBans, Object.values(draft.userPicks), "Your");
  els.championSelectionNote.textContent = draft.phase === "ready"
    ? "Your five picks are locked. Review their power before the simulation."
    : draft.phase === "assign"
      ? "Assign the selected champion to one of your unfilled roles."
      : "Banned and picked champions leave the pool.";
  els.championPool.innerHTML = draft.pool.map((champion, index) => matchChampionCard(champion, draft, index)).join("");
  setSelectedChampionArt(els.pickAssignment, championById(draft.selectedChampionId));
  renderDraftPickAssignment(draft);
  renderDraftLineups(draft);
  const power = draft.phase === "ready" ? Math.round(draftTeamPower(draft)) : null;
  els.draftPowerPreview.textContent = draft.phase === "ready"
    ? `Team power ${power} · Rival power ${Math.round(rivalDraftPower(draft))}`
    : `${pickedCount} / 5 picks locked · Team power updates with every pick.`;
  els.lockMatchDraft.disabled = draft.phase !== "ready";
}

function draftInstruction(draft) {
  if (draft.phase === "ban") return "Choose one champion to ban.";
  if (draft.phase === "pick") return "The opponent has picked. Choose your answer.";
  if (draft.phase === "assign") return "Now assign your selected champion to a player.";
  return "Draft complete. Your roster is ready for the simulation.";
}

function draftSummaryRows(bans, picks, owner) {
  const rows = [
    ...bans.map((id) => `<span class="draft-summary-ban">BAN · ${html(championById(id)?.champion)}</span>`),
    ...picks.map((id) => `<span class="draft-summary-pick">PICK · ${html(championById(id)?.champion)}</span>`),
  ];
  return rows.length ? rows.join("") : `<small>${owner} draft is waiting.</small>`;
}

function matchChampionCard(champion, draft, index) {
  const usedByOpponent = draft.opponentBans.includes(champion.id) || draft.opponentPicks.includes(champion.id);
  const usedByPlayer = draft.playerBans.includes(champion.id) || Object.values(draft.userPicks).includes(champion.id);
  const selected = draft.selectedChampionId === champion.id;
  const disabled = usedByOpponent || usedByPlayer || draft.phase === "ready";
  const actionClass = draft.phase === "ban" ? "is-ban-action" : draft.phase === "pick" || draft.phase === "assign" ? "is-pick-action" : "";
  const stateLabel = usedByOpponent ? (draft.opponentBans.includes(champion.id) ? "Opponent ban" : "Opponent pick") : usedByPlayer ? (draft.playerBans.includes(champion.id) ? "Your ban" : "Your pick") : selected ? "Selected pick" : draft.phase === "ban" ? "Ban champion" : draft.phase === "ready" ? "Locked" : "Pick champion";
  return `<button class="champion-card has-champion-art ${actionClass} ${selected ? "is-selected" : ""} ${usedByOpponent ? "is-rival-used" : ""} ${usedByPlayer ? "is-player-used" : ""}" type="button" data-champion-id="${html(champion.id)}" style="${html(championArtStyle(champion, index * 25))}" ${disabled ? "disabled" : ""}>
    ${championRoleMarkup(champion)}<strong>${html(champion.champion)}</strong><b class="champion-ovr">${championOverall(champion)} <small>OVR</small></b><em>${stateLabel}</em>
  </button>`;
}

function renderDraftPickAssignment(draft) {
  const selected = championById(draft.selectedChampionId);
  els.pickAssignmentTitle.textContent = selected ? `Where will ${selected.champion} go?` : "Choose a champion first.";
  els.pickAssignmentNote.textContent = selected
    ? "Comfort picks and role fit feed one Team Power rating. Any role can use any champion, but fit matters."
    : "Every pick needs an unfilled player slot.";
  els.pickAssignmentSlots.innerHTML = ROLES.map((role) => {
    const player = playerById(state.roster[role]);
    const pickedChampion = championById(draft.userPicks[role]);
    return `<button class="pick-assignment-slot ${pickedChampion ? "is-filled has-champion-art" : ""}" type="button" data-pick-role="${role}" ${pickedChampion ? `style="${html(championArtStyle(pickedChampion))}"` : ""} ${!selected || pickedChampion ? "disabled" : ""}>
      ${roleLabel(role, "slot-role-label")}<strong>${html(player.player)}</strong><small>${pickedChampion ? html(pickedChampion.champion) : selected ? championFitLabel(player, selected, role) : "Awaiting pick"}</small>
    </button>`;
  }).join("");
}

function renderDraftLineups(draft) {
  els.yourDraftLineup.innerHTML = ROLES.map((role) => {
    const player = playerById(state.roster[role]);
    const champion = championById(draft.userPicks[role]);
    return lineupRow(role, player.player, champion, "your");
  }).join("");
  const opponentRoster = (draft.opponent.roster ?? []).slice().sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
  els.rivalLineupTitle.textContent = `${draft.opponent.name} · MSI ${draft.opponent.year}`;
  els.rivalDraftLineup.innerHTML = opponentRoster.map((player, index) => {
    const champion = championById(draft.opponentPicks[index]);
    return lineupRow(player.role, player.player, champion, "rival");
  }).join("");
}

function lineupRow(role, player, champion, side) {
  const championName = champion?.champion ?? "Awaiting pick";
  return `<div class="lineup-row ${side === "rival" ? "is-rival" : ""} ${champion ? "has-champion-art" : ""}" ${champion ? `style="${html(championArtStyle(champion))}"` : ""}>${roleLabel(role, "lineup-role")}<strong>${html(player)}</strong><em>${html(championName)}</em></div>`;
}

function championFitsRole(champion, role) {
  return Object.keys(champion?.roles ?? {}).map(normalizedRole).includes(role);
}

function playerChampionFitScore(player, champion, assignedRole = player.role) {
  const comfort = player.champions?.find((entry) => entry.champion === champion.champion);
  const roleFitBonus = championFitsRole(champion, assignedRole) ? 8 : 0;
  if (comfort) return clamp(Math.round(68 + (comfort.win_rate ?? .5) * 18 + clamp((comfort.kda ?? 0) / 6 * 14) + roleFitBonus), 68, 98);
  return championFitsRole(champion, assignedRole) ? 70 : championFitsRole(champion, player.role) ? 62 : 45;
}

function championFitLabel(player, champion, assignedRole = player.role) {
  const comfort = player.champions?.some((entry) => entry.champion === champion.champion);
  const roleFit = championFitsRole(champion, assignedRole);
  if (comfort && roleFit) return "Comfort fit";
  if (comfort) return "Comfort pick";
  if (roleFit) return "Role fit";
  if (championFitsRole(champion, player.role)) return "Natural-role pick";
  return "Flex risk";
}

function draftPickPower(role, draft) {
  const player = playerById(state.roster[role]);
  const champion = championById(draft.userPicks[role]);
  const playerPower = playerOverall(player) - (player.role === role ? 0 : 9);
  return playerPower * .5 + championOverall(champion) * .3 + playerChampionFitScore(player, champion, role) * .2;
}

function draftTeamPower(draft) {
  return average(ROLES.map((role) => draftPickPower(role, draft))) + (teamCohesionScore() - 60) * .12;
}

function rivalDraftPower(draft) {
  const pickStrength = average(draft.opponentPicks.map((id) => championOverall(championById(id))));
  return draft.opponent.difficulty + (pickStrength - 70) * .18;
}

function tournamentPickPower(role) {
  const player = playerById(state.roster[role]);
  const champion = championById(state.tournamentPicks[player.id]);
  const playerPower = playerOverall(player) - (player.role === role ? 0 : 9);
  return playerPower * .5 + championOverall(champion) * .3 + playerChampionFitScore(player, champion, role) * .2;
}

function tournamentTeamPower() {
  return average(ROLES.map((role) => tournamentPickPower(role))) + (teamCohesionScore() - 60) * .12;
}

function teamPowerScore() {
  return Math.round(tournamentTeamPower());
}

function rivalTeamPower(opponent) {
  return opponent.difficulty;
}

function championById(id) {
  return state.champions.find((champion) => champion.id === id);
}

function pickOne(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomMinute(range) {
  return Math.round((range[0] + Math.random() * (range[1] - range[0])) * 10) / 10;
}

function formatMatchClock(minute) {
  let whole = Math.floor(minute);
  let seconds = Math.round((minute - whole) * 60);
  if (seconds >= 60) {
    whole += 1;
    seconds = 0;
  }
  return `${String(whole).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function matchPhaseForMinute(minute) {
  return MATCH_PHASES.find((phase) => minute >= phase.range[0] && minute < phase.range[1]) ?? MATCH_PHASES.at(-1);
}

function uniqueRoles(roles) {
  return [...new Set(roles.map(normalizedRole).filter((role) => ROLES.includes(role)))];
}

function chooseEventRoles(blueprint) {
  return uniqueRoles(pickOne(blueprint.roleSets ?? [ROLES]));
}

function eventOccurrenceChance(blueprint, context) {
  const closeMatchBonus = Math.max(0, 10 - Math.abs(context.playerPower - context.rivalPower)) * .006;
  const lateGamePenalty = blueprint.minutes[0] >= 30 && context.projectedLength < 34 ? -.16 : 0;
  const stompPenalty = Math.abs(context.playerPower - context.rivalPower) > 18 && blueprint.needsTrailing ? -.12 : 0;
  return clamp(blueprint.baseChance + closeMatchBonus + lateGamePenalty + stompPenalty, .08, .98);
}

function buildEventCandidates(context) {
  const candidates = MATCH_EVENT_BLUEPRINTS
    .filter((blueprint) => blueprint.mandatory || Math.random() < eventOccurrenceChance(blueprint, context))
    .map((blueprint) => ({ blueprint, roles: chooseEventRoles(blueprint), minute: randomMinute(blueprint.minutes) }));

  const usedKeys = new Set(candidates.map((candidate) => candidate.blueprint.key));
  while (candidates.length < 8) {
    const blueprint = pickOne(MATCH_EVENT_BLUEPRINTS.filter((item) => !usedKeys.has(item.key)) || MATCH_EVENT_BLUEPRINTS);
    if (!blueprint) break;
    usedKeys.add(blueprint.key);
    candidates.push({ blueprint, roles: chooseEventRoles(blueprint), minute: randomMinute(blueprint.minutes) });
  }

  return candidates.sort((a, b) => a.minute - b.minute).slice(0, 14);
}

function roleFocusWeight(role, focus) {
  const weights = {
    lane: { top: 1.12, mid: 1.12, bot: 1.08, sup: .94, jng: .9 },
    early: { jng: 1.18, mid: 1.06, top: 1.02, bot: 1.02, sup: 1.04 },
    gank: { jng: 1.38, mid: 1.05, top: 1, bot: 1, sup: 1.08 },
    objective: { jng: 1.32, sup: 1.12, mid: 1.08, bot: 1.04, top: .96 },
    teamfight: { bot: 1.16, mid: 1.12, top: 1.08, jng: 1.02, sup: 1 },
    vision: { sup: 1.35, jng: 1.16, mid: 1.04, bot: .96, top: .9 },
    macro: { mid: 1.18, jng: 1.16, sup: 1.1, top: 1.02, bot: .94 },
    siege: { bot: 1.18, mid: 1.1, top: 1.06, sup: 1, jng: .98 },
    clutch: { jng: 1.22, mid: 1.12, bot: 1.12, sup: 1.02, top: 1.02 },
  };
  return weights[focus]?.[role] ?? 1;
}

function statScoreForFocus(player, focus) {
  if (!player) return 62;
  const attributes = playerAttributes(player);
  const killPressure = clamp((player.avg_kills ?? 0) / 5 * 100);
  const csControl = clamp((player.cs_per_min ?? 0) / 10 * 100);
  const vision = clamp((player.vision_score_per_min ?? 0) / 3 * 100);
  const damage = clamp((player.damage_per_min ?? 0) / 800 * 100);
  const kda = clamp((player.kda ?? 0) / 7 * 100);
  const focusScores = {
    lane: attributes.mechanics * .45 + csControl * .25 + damage * .18 + kda * .12,
    early: attributes.mechanics * .35 + attributes.macro * .28 + killPressure * .22 + kda * .15,
    gank: attributes.macro * .42 + attributes.mechanics * .28 + killPressure * .18 + vision * .12,
    objective: attributes.macro * .44 + attributes.teamfight * .26 + vision * .2 + kda * .1,
    teamfight: attributes.teamfight * .52 + damage * .22 + kda * .16 + attributes.mechanics * .1,
    vision: vision * .48 + attributes.macro * .34 + attributes.teamfight * .18,
    macro: attributes.macro * .54 + vision * .2 + csControl * .14 + attributes.teamfight * .12,
    siege: csControl * .28 + damage * .26 + attributes.macro * .24 + attributes.mechanics * .22,
    clutch: attributes.teamfight * .34 + attributes.mechanics * .28 + kda * .22 + attributes.macro * .16,
  };
  return clamp(focusScores[focus] ?? average(Object.values(attributes)));
}

function userParticipantForRole(role) {
  const player = playerById(state.roster[role]);
  const champion = player ? championById(state.tournamentPicks[player.id]) : null;
  return { role, player, champion, name: player?.player ?? ROLE_LABELS[role] };
}

function rivalParticipantForRole(opponent, role) {
  const roster = opponent.roster ?? [];
  const player = roster.find((candidate) => candidate.role === role) ?? roster.find((candidate) => ROLES.includes(candidate.role)) ?? roster[0];
  return { role, player, champion: null, name: player?.player ?? `${opponent.name} ${ROLE_LABELS[role]}` };
}

function participantImpactScore(participant, side, focus) {
  const player = participant.player;
  if (!player) return side === "player" ? teamPowerScore() : 65;
  const base = playerOverall(player) - (side === "player" && player.role !== participant.role ? 9 : 0);
  const championPower = participant.champion ? championOverall(participant.champion) : clamp(base + 2, 58, 96);
  const fitScore = participant.champion ? playerChampionFitScore(player, participant.champion, participant.role) : base;
  return clamp(base * .38 + statScoreForFocus(player, focus) * .32 + championPower * .16 + fitScore * .14);
}

function sideScoreForRoles(side, roles, opponent, focus) {
  const weightedScores = roles.map((role) => {
    const participant = side === "player" ? userParticipantForRole(role) : rivalParticipantForRole(opponent, role);
    return { score: participantImpactScore(participant, side, focus), weight: roleFocusWeight(role, focus) };
  });
  const totalWeight = weightedScores.reduce((total, item) => total + item.weight, 0) || 1;
  return weightedScores.reduce((total, item) => total + item.score * item.weight, 0) / totalWeight;
}

function eventParticipants(side, roles, opponent, focus) {
  return roles.map((role) => {
    const participant = side === "player" ? userParticipantForRole(role) : rivalParticipantForRole(opponent, role);
    return { ...participant, score: participantImpactScore(participant, side, focus) * roleFocusWeight(role, focus) };
  }).sort((a, b) => b.score - a.score);
}

function decideEventWinner(candidate, advantage, context) {
  if (candidate.blueprint.needsTrailing) return advantage < -12;
  const playerScore = sideScoreForRoles("player", candidate.roles, context.opponent, candidate.blueprint.focus);
  const rivalScore = sideScoreForRoles("rival", candidate.roles, context.opponent, candidate.blueprint.focus);
  const ratingEdge = (playerScore - rivalScore + (context.playerPower - context.rivalPower) * .35) / 175;
  const snowball = advantage / 520;
  const storyBias = (context.won ? .055 : -.055) + ((candidate.minute - 18) / 120) * (context.won ? 1 : -1);
  return Math.random() < clamp(.5 + ratingEdge + snowball + storyBias, .12, .88);
}

function resolveSimulationCandidate(candidate, advantage, context) {
  const { blueprint, roles, minute } = candidate;
  if (blueprint.needsTrailing && Math.abs(advantage) <= 12) return null;
  const playerFavored = decideEventWinner(candidate, advantage, context);
  const side = playerFavored ? "player" : "rival";
  const participants = eventParticipants(side, roles, context.opponent, blueprint.focus);
  const actor = participants[0];
  const support = participants.find((participant) => participant.role !== actor?.role) ?? {
    name: side === "player" ? state.bracket.user.name : context.opponent.name,
  };
  const baseSwing = randomInt(blueprint.swing[0], blueprint.swing[1]);
  const lateWinnerBonus = minute >= 24 && playerFavored === context.won ? 4 : 0;
  const swing = baseSwing + lateWinnerBonus;
  const nextAdvantage = clamp(advantage + (playerFavored ? swing : -swing), -92, 92);
  const champion = actor?.champion?.champion;
  const copy = blueprint.copy[playerFavored ? "player" : "rival"]({
    actor: actor?.name ?? (playerFavored ? state.bracket.user.name : context.opponent.name),
    support: support?.name ?? (playerFavored ? state.bracket.user.name : context.opponent.name),
    champion,
    opponent: context.opponent,
  });
  const phase = matchPhaseForMinute(minute);
  return {
    key: blueprint.key,
    title: blueprint.title,
    minute,
    clock: formatMatchClock(minute),
    phase: phase.label,
    text: copy,
    advantage: nextAdvantage,
    playerFavored,
    roles,
    actorName: actor?.name,
    swing,
  };
}

function startMatchSimulation() {
  const runId = state.simulationRunId + 1;
  state.simulationRunId = runId;
  state.simulation = {
    completed: false,
    running: true,
    result: buildSimulationResult(),
    revealed: 0,
    runId,
  };
  renderSimulation();
  window.setTimeout(() => revealNextSimulationEvent(runId), 650);
}

function revealNextSimulationEvent(runId) {
  const simulation = state.simulation;
  if (!simulation || simulation.runId !== runId || !simulation.running) return;
  simulation.revealed += 1;
  if (simulation.revealed >= simulation.result.events.length) {
    simulation.completed = true;
    simulation.running = false;
  }
  renderSimulation();
  if (!simulation.completed) window.setTimeout(() => revealNextSimulationEvent(runId), 850);
}

function buildSimulationResult() {
  const opponent = state.bracket.currentOpponent;
  const playerPower = teamPowerScore();
  const rivalPower = Math.round(rivalTeamPower(opponent) + (Math.random() * 8 - 4));
  const winChance = clamp(.5 + (playerPower - rivalPower) / 105, .16, .84);
  const won = Math.random() < winChance;
  const events = buildSimulationEvents(won, opponent, playerPower, rivalPower);
  const mvpEvent = events
    .filter((event) => event.playerFavored && !event.final)
    .sort((a, b) => b.swing - a.swing)[0];
  return {
    won,
    playerPower,
    rivalPower,
    winChance,
    events,
    finalAdvantage: won ? 100 : -100,
    mvp: won ? (mvpEvent?.actorName ?? calculateRunStar()?.player?.player) : `${opponent.name} carry`,
  };
}

function buildSimulationEvents(won, opponent, playerPower, rivalPower) {
  const events = [];
  let advantage = 0;
  const context = {
    opponent,
    playerPower,
    rivalPower,
    won,
    projectedLength: randomInt(won ? 29 : 27, Math.abs(playerPower - rivalPower) < 8 ? 43 : 38),
  };
  buildEventCandidates(context).forEach((candidate) => {
    const event = resolveSimulationCandidate(candidate, advantage, context);
    if (!event) return;
    advantage = event.advantage;
    events.push(event);
  });
  const lastMinute = events.at(-1)?.minute ?? 25;
  const finalMinute = Math.min(48, Math.max(26, Math.ceil(Math.max(lastMinute + randomInt(2, 6), context.projectedLength))));
  const finalClock = formatMatchClock(finalMinute);
  events.push({
    key: "final",
    title: "NEXUS DOWN!",
    minute: finalMinute,
    clock: finalClock,
    phase: matchPhaseForMinute(finalMinute).label,
    text: won
      ? `${state.bracket.user.name} wins the final push and destroys the Nexus.`
      : `${opponent.name} wins the final push and destroys the Nexus.`,
    advantage: won ? 100 : -100,
    playerFavored: won,
    roles: ROLES,
    final: true,
    swing: 100,
  });
  return events;
}

function renderSimulation() {
  const simulation = state.simulation;
  const opponent = state.bracket?.currentOpponent;
  if (!opponent || !simulation) return;
  const stage = TOURNAMENT_STAGES[state.bracket.currentStage];
  const projectedPlayer = teamPowerScore();
  const projectedRival = Math.round(rivalTeamPower(opponent));
  const result = simulation.result;
  els.simulationStage.textContent = stage.label.toUpperCase();
  els.simulationScore.innerHTML = `<span>${html(state.bracket.user.name)}</span><b>VS</b><span>${html(opponent.name)}</span>`;
  els.simulationPlayerPower.textContent = result?.playerPower ?? projectedPlayer;
  els.simulationRivalPower.textContent = result?.rivalPower ?? projectedRival;
  if (!result) {
    els.simulationTitle.innerHTML = "The series is<br>about to begin.";
    els.simulationCopy.textContent = `Your tournament composition is locked. Estimated win chance: ${Math.round(clamp(.5 + (projectedPlayer - projectedRival) / 105, .16, .84) * 100)}%.`;
    els.simulationClock.textContent = "00:00";
    els.simulationPhase.textContent = "PREGAME";
    els.simulationResultBanner.hidden = true;
    els.simulationResultBanner.className = "simulation-result-banner";
    els.simulationResultBanner.innerHTML = "";
    els.advantageMarker.style.left = "50%";
    els.simulationEvents.innerHTML = "<p>Press simulate to play out the match.</p>";
    els.simulateMatch.hidden = false;
    els.continueBracket.hidden = true;
    return;
  }
  const visibleEvents = result.events.slice(0, simulation.revealed);
  const latestEvent = visibleEvents.at(-1);
  if (!simulation.completed) {
    const phase = matchPhaseForMinute(latestEvent?.minute ?? 0);
    els.simulationClock.textContent = latestEvent?.clock ?? "00:00";
    els.simulationPhase.textContent = phase.label;
    els.simulationResultBanner.hidden = true;
    els.simulationResultBanner.className = "simulation-result-banner";
    els.simulationResultBanner.innerHTML = "";
    els.simulationTitle.innerHTML = latestEvent ? `${html(phase.label)}<br>${html(latestEvent.clock)}` : "MATCH<br>LOADING.";
    els.simulationCopy.textContent = latestEvent
      ? latestEvent.text
      : "The opening wave is forming.";
    els.advantageMarker.style.left = `${((latestEvent?.advantage ?? 0) + 100) / 2}%`;
    const stackedEvents = visibleEvents.slice().reverse();
    els.simulationEvents.innerHTML = stackedEvents.length
      ? stackedEvents.map((event, index) => simulationEventRow(event, index === 0, index)).join("")
      : "<p>Summoner's Rift is loading...</p>";
    els.simulateMatch.hidden = true;
    els.continueBracket.hidden = true;
    return;
  }
  const destination = result.won ? stage.win : stage.loss;
  const finalEvent = result.events.at(-1);
  els.simulationClock.textContent = finalEvent.clock;
  els.simulationPhase.textContent = result.won ? "VICTORY" : "DEFEAT";
  els.simulationTitle.innerHTML = result.won ? "VICTORY<br>ON THE RIFT." : destination === "eliminated" ? "DEFEAT<br>RUN ENDED." : "DEFEAT<br>STILL ALIVE.";
  els.simulationCopy.textContent = result.won
    ? destination === "champion" ? `${result.mvp} earns MVP. One more win has made you MSI champions.` : `${result.mvp} earns MVP. You advance to ${TOURNAMENT_STAGES[destination].label}.`
    : destination === "eliminated" ? `${opponent.name} eliminates ${state.bracket.user.name} from the tournament.` : `${state.bracket.user.name} drops to ${TOURNAMENT_STAGES[destination].label}.`;
  els.simulationResultBanner.hidden = false;
  els.simulationResultBanner.className = `simulation-result-banner ${result.won ? "is-victory" : "is-defeat"}`;
  els.simulationResultBanner.innerHTML = `<span>${result.won ? "VICTORY" : "DEFEAT"}</span><strong>${html(result.won ? state.bracket.user.name : opponent.name)}</strong><small>${html(finalEvent.clock)} · ${html(result.won ? "Nexus destroyed" : "Nexus lost")}</small>`;
  els.advantageMarker.style.left = `${(result.finalAdvantage + 100) / 2}%`;
  els.simulationEvents.innerHTML = result.events.slice().reverse().map((event, index) => simulationEventRow(event, false, index)).join("");
  els.simulateMatch.hidden = true;
  els.continueBracket.hidden = false;
}

function simulationEventRow(event, isNew = false, index = 0) {
  const advantage = `${event.advantage > 0 ? "+" : ""}${event.advantage}`;
  return `<div class="simulation-event ${event.playerFavored ? "is-player" : "is-rival"} ${event.final ? "is-final" : ""} ${isNew ? "is-new" : ""}" style="--delay: ${index * 35}ms">
    <span class="simulation-event-minute">${html(event.clock ?? `${event.minute}'`)}</span>
    <div class="simulation-event-copy"><strong>${html(event.title)}</strong><p>${html(event.text)}</p></div>
    <div class="simulation-event-side"><span class="simulation-event-roles">${uniqueRoles(event.roles ?? []).map((role) => roleIcon(role, "role-icon-tiny")).join("")}</span><b>${advantage}</b></div>
  </div>`;
}

function renderRunSummary() {
  const run = state.completedRun;
  if (!run) return;
  const { bracket, finalPicks, finalResult } = run;
  const champion = bracket.outcome === "champion";
  const wins = bracket.history.filter((match) => match.won).length;
  const losses = bracket.history.length - wins;
  const lastMatch = bracket.history.at(-1);
  const runStar = calculateRunStar();
  els.runSummaryEmblem.textContent = state.selectedTeam.source.team.slice(0, 3).toUpperCase();
  els.runSummaryEmblem.className = `review-emblem ${state.selectedTeam.key}`;
  els.runSummaryKicker.textContent = champion ? "MSI CHAMPIONS · RUN COMPLETE" : "RUN COMPLETE · ELIMINATED";
  els.runSummaryTitle.textContent = champion ? `${bracket.user.name} conquered MSI.` : `${bracket.user.name}'s run is over.`;
  els.runSummaryCopy.textContent = champion
    ? "An unforgettable roster, a winning draft and a completed road to glory."
    : "The bracket closes here, but every run creates a new story.";
  els.runFinalPosition.textContent = finalPosition(bracket);
  els.runRecord.textContent = `${wins}-${losses} match record`;
  els.runTeamPower.textContent = teamPowerScore();
  els.runWins.textContent = wins;
  els.runMvp.textContent = `${runStar.player.player} · ${runStar.champion?.champion ?? "No pick"}`;
  els.runLastRival.textContent = lastMatch.opponent.name;
  els.runRoster.innerHTML = ROLES.map((role) => runRosterCard(role, finalPicks)).join("");
  els.runHistory.innerHTML = bracket.history.map((match, index) => `<div class="run-history-row ${match.won ? "is-win" : "is-loss"}"><span>${index + 1}</span><strong>${html(TOURNAMENT_STAGES[match.stage].label)}</strong><p>${match.won ? "Won" : "Lost"} vs ${html(match.opponent.name)} · MSI ${match.opponent.year}</p><b>${match.won ? "W" : "L"}</b></div>`).join("");
  els.summaryBracket.innerHTML = run.bracketMarkup;
}

function runRosterCard(role, picks) {
  const player = playerById(state.roster[role]);
  const champion = championById(picks?.[player.id]);
  const offRole = player.role !== role;
  const overall = playerOverall(player) - (offRole ? 9 : 0);
  return `<article class="run-roster-card ${offRole ? "is-offrole" : ""} ${champion ? "has-champion-art" : ""}" ${champion ? `style="${html(championArtStyle(champion))}"` : ""}>${roleLabel(role, "run-role")}<strong>${html(player.player)}</strong><em>${overall} OVR</em><p>${champion ? html(champion.champion) : "No final pick"}</p><small>${offRole ? "Off-role" : "Natural role"}</small></article>`;
}

function calculateRunStar() {
  const candidates = ROLES.map((role) => {
    const player = playerById(state.roster[role]);
    const champion = championById(state.tournamentPicks[player.id]);
    const roleAdjustedOvr = playerOverall(player) - (player.role === role ? 0 : 9);
    const fitScore = playerChampionFitScore(player, champion, role);
    const score = roleAdjustedOvr + championOverall(champion) * .12 + fitScore * .18;
    return { player, champion, score };
  });
  return candidates.sort((a, b) => b.score - a.score || a.player.player.localeCompare(b.player.player))[0];
}

function finalPosition(bracket) {
  if (bracket.outcome === "champion") return "1ST";
  const lastStage = bracket.history.at(-1)?.stage;
  if (lastStage === "grand-final") return "2ND";
  if (lastStage === "lower-final") return "3RD";
  if (lastStage === "lower-r2") return "5TH-6TH";
  return "7TH-8TH";
}

async function shareCompletedRun() {
  const run = state.completedRun;
  if (!run) return;
  const wins = run.bracket.history.filter((match) => match.won).length;
  const losses = run.bracket.history.length - wins;
  const result = run.bracket.outcome === "champion" ? "MSI CHAMPIONS" : `Finished ${finalPosition(run.bracket)}`;
  const runStar = calculateRunStar();
  const text = `${state.selectedTeam.source.team} · ${result}\nRoad to MSI run: ${wins}-${losses}\nTeam power: ${teamPowerScore()}\nRun star: ${runStar.player.player} on ${runStar.champion?.champion ?? "their tournament pick"}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Road to MSI", text });
      els.shareRun.textContent = "Shared";
      window.setTimeout(() => { els.shareRun.textContent = "Share result"; }, 1800);
      return;
    } catch {
      return;
    }
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    els.shareRun.textContent = "Copied to clipboard";
    window.setTimeout(() => { els.shareRun.textContent = "Share result"; }, 1800);
  }
}

function reviewCard(player, assignedRole, index) {
  const offRole = player.role !== assignedRole;
  const attributes = playerAttributes(player);
  const adjustedOverall = playerOverall(player) - (offRole ? 9 : 0);
  const traits = playerTraits(player, assignedRole);
  const champion = championById(state.tournamentPicks[player.id]);
  return `
    <button class="review-player ${offRole ? "is-offrole" : ""} ${champion ? "has-champion-art" : ""} ${state.swapSourceRole === assignedRole ? "is-swap-source" : ""}" type="button" data-review-role="${assignedRole}" style="${html(championArtStyle(champion, index * 65))}" ${state.swapMode ? "" : "disabled"}>
      <span class="review-card-header">${roleLabel(assignedRole, "review-role")}<strong>${adjustedOverall} <small>OVR</small></strong></span>
      <span class="review-player-name">${html(player.player)}</span>
      <span class="review-player-meta">${html(player.team)} · Natural: ${ROLE_LABELS[player.role]} · Card: MSI ${player.cardYear}</span>
      <span class="review-champion">${champion ? `TOURNAMENT PICK · ${html(champion.champion)}` : "TOURNAMENT PICK · PENDING"}</span>
      <span class="review-stats"><span>MEC <b>${attributes.mechanics}</b></span><span>MAC <b>${attributes.macro}</b></span><span>TF <b>${attributes.teamfight}</b></span></span>
      <span class="trait-list">${traits.map((trait) => `<span>${html(trait)}</span>`).join("")}</span>
    </button>`;
}

function playerTraits(player, assignedRole) {
  const traits = [];
  if (player.role !== assignedRole) traits.push("Off-role · -9");
  else traits.push("Natural role");
  if ((player.champion_pool ?? 0) >= 5) traits.push("Wide champion pool");
  if ((player.kda ?? 0) >= 5) traits.push("Reliable teamfighter");
  if ((player.win_rate ?? 0) >= .65) traits.push("Winning mentality");
  return traits.slice(0, 3);
}

function teamCohesionScore() {
  const players = ROLES.map((role) => playerById(state.roster[role]));
  const sameSource = players.filter((player) => player.team === state.selectedTeam.source.team).length;
  const naturalRoles = players.filter((player, index) => player.role === ROLES[index]).length;
  const familiarPairs = matchingPairs(players, (a, b) => a.team === b.team);
  const regionalPairs = matchingPairs(players, (a, b) => regionGroup(a.region) === regionGroup(b.region));
  const championRoleFits = ROLES.filter((role) => {
    const player = playerById(state.roster[role]);
    return championFitsRole(championById(state.tournamentPicks[player.id]), role);
  }).length;
  const regionCounts = players.reduce((counts, player) => {
    const region = regionGroup(player.region);
    counts[region] = (counts[region] ?? 0) + 1;
    return counts;
  }, {});
  const uniqueRegions = Object.keys(regionCounts).length;
  const largestRegionGroup = Math.max(...Object.values(regionCounts));
  const regionMix = uniqueRegions === 5 ? 15 : largestRegionGroup === 5 ? -12 : largestRegionGroup === 4 ? -7 : 0;
  return clamp(52 + state.selectedTeam.bonus + sameSource * 3 + naturalRoles * 4 + championRoleFits * 2 + familiarPairs * 2 + regionalPairs + regionMix - (5 - naturalRoles) * 6);
}

function matchingPairs(players, match) {
  return players.reduce((total, player, index) => total + players.slice(index + 1).filter((other) => match(player, other)).length, 0);
}

function powerLabel(score) {
  if (score >= 85) return "ELITE POWER";
  if (score >= 75) return "DANGEROUS TEAM";
  if (score >= 65) return "SOLID TEAM";
  return "DEVELOPING TEAM";
}

function attendanceKey(player) {
  return player.player_id || player.player;
}

function addAttendance(map, key, year) {
  const years = map.get(key) ?? [];
  if (!years.includes(year)) years.push(year);
  map.set(key, years.sort((a, b) => a - b));
}

function msiYearText(years) {
  return (years ?? []).join(" · ") || "No data";
}

function playerById(id) {
  return state.players.find((player) => player.id === id);
}

init().catch((error) => {
  console.error(error);
  els.meta.textContent = "MSI cards could not be loaded.";
});
