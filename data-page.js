const ROLES = ["top", "jng", "mid", "bot", "sup"];
const ROLE_LABELS = { top: "TOP", jng: "JUNGLA", mid: "MID", bot: "ADC", sup: "SUPPORT" };

const state = {
  years: [],
  players: [],
  champions: [],
  teams: [],
  view: "players",
  query: "",
  year: "all",
  visibleRows: 20,
};

const els = {
  meta: document.querySelector("#data-meta"),
  search: document.querySelector("#data-search"),
  year: document.querySelector("#data-year"),
  toggles: [...document.querySelectorAll("[data-view]")],
  summary: document.querySelector("#data-summary"),
  viewLabel: document.querySelector("#data-view-label"),
  tableTitle: document.querySelector("#data-table-title"),
  resultCount: document.querySelector("#data-result-count"),
  table: document.querySelector("#data-table"),
  loadMore: document.querySelector("#data-load-more"),
};

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const average = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
const html = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
const pct = (value) => value == null ? "--" : `${Math.round(value * 100)}%`;
const number = (value, digits = 1) => value == null ? "--" : Number(value).toFixed(digits).replace(/\.0$/, "");

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

function championRoleKeys(champion) {
  return Object.keys(champion.roles ?? {}).map(normalizedRole).filter((role) => ROLES.includes(role));
}

function championRoleText(roleKeys) {
  return roleKeys.length ? roleKeys.map((role) => ROLE_LABELS[role]).join(" · ") : "FLEX";
}

function championRoleMarkup(roleKeys) {
  if (!roleKeys.length) return `<span class="champion-role-icons is-flex">FLEX</span>`;
  return `<span class="champion-role-icons data-role-icons">${roleKeys.map((role) => roleIcon(role, "role-icon-tiny")).join("")}<span>${html(championRoleText(roleKeys))}</span></span>`;
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

function championOverall(champion) {
  const winRate = (champion.win_rate ?? .5) * 100;
  const presence = (champion.presence_rate ?? 0) * 100;
  const kda = clamp((champion.kda ?? 0) / 6 * 100);
  return clamp(Math.round(52 + winRate * .16 + presence * .16 + kda * .12), 58, 96);
}

function teamDifficulty(team) {
  const playerScore = average(team.players.map((player) => playerOverall(player)));
  const winRate = (team.result?.win_rate ?? .5) * 100;
  const placement = String(team.result?.placement ?? "").toLowerCase();
  const placementBonus = placement.includes("champion") ? 10 : placement.includes("final") ? 7 : placement.includes("semi") ? 4 : 0;
  return clamp(Math.round(playerScore * .68 + winRate * .22 + placementBonus), 60, 99);
}

function searchable(values) {
  return values.map((value) => String(value ?? "").toLowerCase()).join(" ");
}

function flattenDataset(dataset) {
  state.years = Object.values(dataset.years).filter((year) => year.game_count > 0).sort((a, b) => b.year - a.year);
  state.players = state.years.flatMap((year) => (year.teams ?? []).flatMap((team) => (team.players ?? []).map((player) => {
    const role = normalizedRole(player.primary_position);
    const attributes = playerAttributes(player);
    const topChampions = (player.champions ?? []).slice(0, 5).map((champion) => champion.champion).join(" · ");
    return {
      ...player,
      role,
      year: year.year,
      tournament: year.tournament,
      team: team.team,
      region: team.region,
      league: team.league,
      ovr: playerOverall(player),
      mechanics: attributes.mechanics,
      macro: attributes.macro,
      teamfight: attributes.teamfight,
      topChampions,
      search: searchable([player.player, team.team, team.region, team.league, role, topChampions, year.year]),
    };
  }))).filter((player) => ROLES.includes(player.role));

  state.champions = state.years.flatMap((year) => (year.champion_stats ?? []).map((champion) => {
    const roleKeys = championRoleKeys(champion);
    return {
      ...champion,
      year: year.year,
      tournament: year.tournament,
      ovr: championOverall(champion),
      roleKeys,
      roleText: championRoleText(roleKeys),
      search: searchable([champion.champion, Object.keys(champion.roles ?? {}).join(" "), year.year]),
    };
  }));

  state.teams = state.years.flatMap((year) => (year.teams ?? []).map((team) => {
    const roster = (team.players ?? []).map((player) => player.player).join(" · ");
    const avgOvr = Math.round(average((team.players ?? []).map((player) => playerOverall(player))));
    return {
      ...team,
      year: year.year,
      tournament: year.tournament,
      difficulty: teamDifficulty(team),
      avgOvr,
      roster,
      search: searchable([team.team, team.region, team.league, team.result?.placement, roster, year.year]),
    };
  }));
}

function bindEvents() {
  els.search.addEventListener("input", () => {
    state.query = els.search.value.trim().toLowerCase();
    resetVisibleRows();
    render();
  });
  els.year.addEventListener("change", () => {
    state.year = els.year.value;
    resetVisibleRows();
    render();
  });
  els.toggles.forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      resetVisibleRows();
      render();
    });
  });
  els.loadMore.addEventListener("click", () => {
    state.visibleRows += 10;
    render();
  });
}

function renderYearOptions() {
  els.year.innerHTML = '<option value="all">All years</option>' + state.years.map((year) => `<option value="${year.year}">MSI ${year.year}</option>`).join("");
}

function filteredRows() {
  const rows = state[state.view];
  return rows.filter((row) => {
    const matchesYear = state.year === "all" || String(row.year) === state.year;
    const matchesQuery = !state.query || row.search.includes(state.query);
    return matchesYear && matchesQuery;
  });
}

function resetVisibleRows() {
  state.visibleRows = 20;
}

function sortRows(rows) {
  if (state.view === "players") return rows.slice().sort((a, b) => b.ovr - a.ovr || b.year - a.year || a.player.localeCompare(b.player));
  if (state.view === "champions") return rows.slice().sort((a, b) => b.ovr - a.ovr || b.presence - a.presence || a.champion.localeCompare(b.champion));
  return rows.slice().sort((a, b) => b.difficulty - a.difficulty || b.year - a.year || a.team.localeCompare(b.team));
}

function renderSummary() {
  const uniqueChampions = new Set(state.champions.map((champion) => champion.champion)).size;
  const latest = state.years[0]?.year ?? "--";
  els.summary.innerHTML = [
    ["Active years", state.years.length],
    ["Player cards", state.players.length],
    ["Team campaigns", state.teams.length],
    ["Unique champions", uniqueChampions],
    ["Latest MSI", latest],
  ].map(([label, value]) => `<div><span>${html(label)}</span><strong>${html(value)}</strong></div>`).join("");
}

function render() {
  els.toggles.forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const rows = sortRows(filteredRows());
  const visibleRows = rows.slice(0, state.visibleRows);
  const hasMore = rows.length > visibleRows.length;
  els.viewLabel.textContent = state.view.toUpperCase();
  els.tableTitle.textContent = state.view === "players" ? "Player cards" : state.view === "champions" ? "Champion cards" : "Team campaigns";
  els.resultCount.textContent = rows.length
    ? `Showing ${visibleRows.length} of ${rows.length} row${rows.length === 1 ? "" : "s"}`
    : "0 rows";
  els.table.innerHTML = state.view === "players" ? playerTable(visibleRows) : state.view === "champions" ? championTable(visibleRows) : teamTable(visibleRows);
  els.loadMore.hidden = !hasMore;
  els.loadMore.textContent = hasMore ? `Show ${Math.min(10, rows.length - visibleRows.length)} more` : "All rows shown";
}

function table(headers, rows) {
  return `<table class="data-table">
    <thead><tr>${headers.map((header) => `<th>${html(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows.join("") || `<tr><td colspan="${headers.length}">No rows match the current filters.</td></tr>`}</tbody>
  </table>`;
}

function playerTable(rows) {
  const sorted = rows.slice().sort((a, b) => b.ovr - a.ovr || b.year - a.year || a.player.localeCompare(b.player));
  return table(["OVR", "Player", "Role", "Team", "MSI", "W%", "KDA", "KP", "DPM", "Pool", "Top champions", "MEC/MAC/TF"], sorted.map((player) => `
    <tr>
      <td><strong>${player.ovr}</strong></td>
      <td>${html(player.player)}</td>
      <td>${roleLabel(player.role, "data-role-label")}</td>
      <td>${html(player.team)}</td>
      <td>${player.year}</td>
      <td>${pct(player.win_rate)}</td>
      <td>${number(player.kda)}</td>
      <td>${pct(player.kill_participation)}</td>
      <td>${number(player.damage_per_min)}</td>
      <td>${html(player.champion_pool)}</td>
      <td>${html(player.topChampions || "No champion data")}</td>
      <td>${player.mechanics}/${player.macro}/${player.teamfight}</td>
    </tr>`));
}

function championTable(rows) {
  const sorted = rows.slice().sort((a, b) => b.ovr - a.ovr || b.presence - a.presence || a.champion.localeCompare(b.champion));
  return table(["OVR", "Champion", "MSI", "Roles", "Presence", "Presence %", "Win %", "KDA"], sorted.map((champion) => `
    <tr>
      <td><strong>${champion.ovr}</strong></td>
      <td>${html(champion.champion)}</td>
      <td>${champion.year}</td>
      <td>${championRoleMarkup(champion.roleKeys)}</td>
      <td>${html(champion.presence)}</td>
      <td>${pct(champion.presence_rate)}</td>
      <td>${pct(champion.win_rate)}</td>
      <td>${number(champion.kda)}</td>
    </tr>`));
}

function teamTable(rows) {
  const sorted = rows.slice().sort((a, b) => b.difficulty - a.difficulty || b.year - a.year || a.team.localeCompare(b.team));
  return table(["Difficulty", "Team", "MSI", "Region", "League", "W%", "Placement", "Avg OVR", "Roster"], sorted.map((team) => `
    <tr>
      <td><strong>${team.difficulty}</strong></td>
      <td>${html(team.team)}</td>
      <td>${team.year}</td>
      <td>${html(team.region)}</td>
      <td>${html(team.league)}</td>
      <td>${pct(team.result?.win_rate)}</td>
      <td>${html(team.result?.placement ?? "Calculated only")}</td>
      <td>${team.avgOvr}</td>
      <td>${html(team.roster)}</td>
    </tr>`));
}

async function init() {
  const response = await fetch("data/msi_game_dataset.json");
  if (!response.ok) throw new Error(`Dataset request failed: ${response.status}`);
  const dataset = await response.json();
  flattenDataset(dataset);
  renderYearOptions();
  renderSummary();
  bindEvents();
  render();
  const firstYear = state.years.at(-1)?.year;
  const lastYear = state.years[0]?.year;
  els.meta.textContent = `MSI ${firstYear}-${lastYear} · ${state.players.length} player cards`;
}

init().catch((error) => {
  console.error(error);
  els.meta.textContent = "Data could not be loaded.";
  els.table.innerHTML = '<p class="data-error">Data could not be loaded.</p>';
});
