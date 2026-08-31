import * as fs from "fs";
import * as path from "path";

const data = JSON.parse(
  fs.readFileSync(path.join("docs", "bug-review.json"), "utf8")
);
const rows = data.rows as any[];
const curriculum = data.curriculum as any[];

const scenes = [...new Set(rows.map((r) => r.scene))].map((id) => ({
  id,
  name: rows.find((r) => r.scene === id).sceneName,
  count: rows.filter((r) => r.scene === id).length,
}));
const cats = [...new Set(rows.map((r) => r.category))].map((c) => ({
  id: c,
  label: rows.find((r) => r.category === c).categoryLabel,
}));

const sceneChips = scenes
  .map(
    (s) =>
      `<button class="chip" data-f="scene" data-v="${s.id}" aria-pressed="false">${s.name} ${s.count}</button>`
  )
  .join("\n    ");
const bandChips = [1, 2, 3, 4]
  .map(
    (b) =>
      `<button class="chip" data-f="band" data-v="${b}" aria-pressed="false">밴드 ${b}</button>`
  )
  .join("\n    ");
const catChips = cats
  .map(
    (c) =>
      `<button class="chip" data-f="cat" data-v="${c.id}" aria-pressed="false">${c.label}</button>`
  )
  .join("\n    ");

const html = `<title>버그 검수 콘솔</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root {
  --ground: #f1f3ef; --surface: #fbfcfa; --surface-2: #e9ece6;
  --ink: #161a17; --ink-2: #4a524a; --ink-3: #798278; --line: #d5dad2;
  --accent: #a8621b; --accent-soft: #f0e2d2;
  --b1: #3f7f52; --b2: #6f8a38; --b3: #b07d15; --b4: #a83f29; --cut: #a83f29;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #141714; --surface: #1b1f1b; --surface-2: #232823;
    --ink: #e9ece7; --ink-2: #a8b1a6; --ink-3: #7c857b; --line: #2e352e;
    --accent: #d99248; --accent-soft: #3a2a19;
    --b1: #6fbf85; --b2: #a3bf5e; --b3: #e0ac45; --b4: #e0705a; --cut: #e0705a;
  }
}
:root[data-theme="dark"] {
  --ground: #141714; --surface: #1b1f1b; --surface-2: #232823;
  --ink: #e9ece7; --ink-2: #a8b1a6; --ink-3: #7c857b; --line: #2e352e;
  --accent: #d99248; --accent-soft: #3a2a19;
  --b1: #6fbf85; --b2: #a3bf5e; --b3: #e0ac45; --b4: #e0705a; --cut: #e0705a;
}

* { box-sizing: border-box; }
body {
  margin: 0; background: var(--ground); color: var(--ink);
  font-family: "IBM Plex Sans", system-ui, sans-serif; font-size: 14px; line-height: 1.5;
}
.wrap { max-width: 1180px; margin: 0 auto; padding: 28px 20px 120px; }
header { display: flex; flex-direction: column; gap: 6px; }
h1 {
  font-family: "Bricolage Grotesque", system-ui, sans-serif; font-weight: 700;
  font-size: 30px; margin: 0; letter-spacing: -0.02em; text-wrap: balance;
}
.sub { color: var(--ink-2); max-width: 64ch; margin: 0; }
code {
  font-family: "IBM Plex Mono", monospace; font-size: 12.5px;
  background: var(--surface-2); padding: 1px 5px; border-radius: 4px;
}
.stats { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 14px; }
.stat {
  background: var(--surface); border: 1px solid var(--line); border-radius: 8px;
  padding: 9px 13px; display: flex; flex-direction: column; gap: 1px; min-width: 100px;
}
.stat b {
  font-family: "IBM Plex Mono", monospace; font-size: 19px; font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.stat span { font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.07em; }
.toolbar {
  position: sticky; top: 0; z-index: 5; background: var(--ground);
  padding: 10px 0; border-bottom: 1px solid var(--line);
  display: flex; flex-wrap: wrap; gap: 7px; align-items: center;
}
.chip {
  font: inherit; font-size: 12.5px; padding: 5px 11px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink-2);
}
.chip[aria-pressed="true"] {
  background: var(--accent-soft); border-color: var(--accent); color: var(--ink); font-weight: 600;
}
.chip:focus-visible, .btn:focus-visible, input:focus-visible, th:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
.sep { width: 1px; height: 20px; background: var(--line); margin: 0 3px; }
input[type="search"] {
  font: inherit; font-size: 13px; padding: 6px 11px; border-radius: 999px;
  border: 1px solid var(--line); background: var(--surface); color: var(--ink); min-width: 190px;
}
.tablewrap {
  overflow-x: auto; margin-top: 14px; border: 1px solid var(--line);
  border-radius: 10px; background: var(--surface);
}
table { border-collapse: collapse; width: 100%; min-width: 940px; }
th {
  text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--ink-3); font-weight: 600; padding: 10px 12px; border-bottom: 1px solid var(--line);
  background: var(--surface-2); cursor: pointer; white-space: nowrap;
}
th.plain { cursor: default; }
td { padding: 9px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
tr:last-child td { border-bottom: none; }
tr.cut td { opacity: 0.42; }
tr.cut .desc { text-decoration: line-through; }
.band {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: "IBM Plex Mono", monospace; font-variant-numeric: tabular-nums;
}
.band::before {
  content: ""; width: 3px; height: 15px; border-radius: 2px;
  background: var(--bandcolor, var(--ink-3));
}
.b1 { --bandcolor: var(--b1); } .b2 { --bandcolor: var(--b2); }
.b3 { --bandcolor: var(--b3); } .b4 { --bandcolor: var(--b4); }
.b0 { --bandcolor: var(--ink-3); }
.score, .stages, .id {
  font-family: "IBM Plex Mono", monospace; font-variant-numeric: tabular-nums;
}
.score { color: var(--ink-2); }
.answers { font-weight: 600; white-space: nowrap; }
.desc { color: var(--ink-2); }
.stages { font-size: 12px; color: var(--ink-3); }
.id { font-size: 11.5px; color: var(--ink-3); white-space: nowrap; }
.cat { font-size: 12.5px; white-space: nowrap; }
.cutbtn {
  font: inherit; font-size: 12px; padding: 3px 9px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--line); background: transparent; color: var(--ink-3);
}
tr.cut .cutbtn { border-color: var(--cut); color: var(--cut); font-weight: 600; }
.tray {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 10;
  background: var(--surface); border-top: 1px solid var(--line);
  padding: 12px 20px; display: flex; gap: 12px; align-items: center;
  justify-content: center; flex-wrap: wrap;
}
.tray.empty { display: none; }
.tray p { margin: 0; color: var(--ink-2); }
.tray b { font-family: "IBM Plex Mono", monospace; color: var(--ink); }
.btn {
  font: inherit; font-weight: 600; font-size: 13px; padding: 8px 15px;
  border-radius: 8px; cursor: pointer; border: 1px solid var(--accent);
  background: var(--accent); color: #fff;
}
.btn.ghost { background: transparent; color: var(--ink-2); border-color: var(--line); }
.empty-row td { text-align: center; color: var(--ink-3); padding: 30px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<div class="wrap">
  <header>
    <h1>버그 검수 콘솔</h1>
    <p class="sub">엔진이 생성한 버그 ${rows.length}개. 뺄 항목을 <b>제외</b>로 표시한 뒤 아래에서 ID 목록을 복사해 <code>src/engine/exclusions.ts</code>에 붙여넣으세요. 표시는 이 브라우저에 저장됩니다.</p>
  </header>

  <div class="stats" id="stats"></div>

  <div class="toolbar">
    <button class="chip" data-f="scene" data-v="" aria-pressed="true">전체 씬</button>
    ${sceneChips}
    <span class="sep"></span>
    <button class="chip" data-f="band" data-v="" aria-pressed="true">전체 밴드</button>
    ${bandChips}
    <span class="sep"></span>
    ${catChips}
    <span class="sep"></span>
    <input type="search" id="q" placeholder="오브젝트 · 설명 검색">
  </div>

  <div class="tablewrap">
    <table>
      <thead><tr>
        <th class="plain"></th>
        <th data-sort="score" tabindex="0">난이도</th>
        <th data-sort="band" tabindex="0">밴드</th>
        <th data-sort="categoryLabel" tabindex="0">카테고리</th>
        <th data-sort="answers" tabindex="0">정답 지목</th>
        <th data-sort="desc" tabindex="0">설명</th>
        <th class="plain">스테이지</th>
        <th data-sort="fullId" tabindex="0">ID</th>
      </tr></thead>
      <tbody id="body"></tbody>
    </table>
  </div>
</div>

<div class="tray empty" id="tray">
  <p>제외 표시 <b id="cutcount">0</b>개</p>
  <button class="btn" id="copy">exclusions.ts 형식으로 복사</button>
  <button class="btn ghost" id="clear">표시 전체 해제</button>
</div>

<script>
const ROWS = ${JSON.stringify(rows)};
const STAGE_COUNT = ${curriculum.length};
const KEY = "fb_bug_cuts";
let cuts = new Set();
try { cuts = new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch (e) {}
const filters = { scene: "", band: "", cat: new Set() };
let sortKey = "score", sortDir = 1;

function save() { try { localStorage.setItem(KEY, JSON.stringify([...cuts])); } catch (e) {} }

function visible() {
  const q = (document.getElementById("q").value || "").trim().toLowerCase();
  return ROWS.filter(function (r) {
    return (!filters.scene || r.scene === filters.scene)
      && (!filters.band || String(r.band) === filters.band)
      && (filters.cat.size === 0 || filters.cat.has(r.category))
      && (!q || (r.answers + " " + r.desc + " " + r.fullId).toLowerCase().indexOf(q) !== -1);
  }).sort(function (a, b) {
    const x = a[sortKey], y = b[sortKey];
    const c = typeof x === "number" ? x - y : String(x).localeCompare(String(y), "ko");
    return c * sortDir;
  });
}

function renderStats(rows) {
  const kept = rows.filter(function (r) { return !cuts.has(r.fullId); }).length;
  const bands = [1, 2, 3, 4].map(function (b) {
    return rows.filter(function (r) { return r.band === b; }).length;
  });
  document.getElementById("stats").innerHTML =
    '<div class="stat"><b>' + rows.length + '</b><span>표시 중</span></div>'
    + '<div class="stat"><b>' + kept + '</b><span>유지</span></div>'
    + '<div class="stat"><b>' + (rows.length - kept) + '</b><span>제외 표시</span></div>'
    + bands.map(function (n, i) {
        return '<div class="stat"><b>' + n + '</b><span>밴드 ' + (i + 1) + '</span></div>';
      }).join("")
    + '<div class="stat"><b>' + STAGE_COUNT + '</b><span>스테이지</span></div>';
}

function render() {
  const rows = visible();
  document.getElementById("body").innerHTML = rows.length
    ? rows.map(function (r) {
        const isCut = cuts.has(r.fullId);
        return '<tr class="' + (isCut ? "cut" : "") + '">'
          + '<td><button class="cutbtn" data-id="' + r.fullId + '">' + (isCut ? "제외됨" : "제외") + '</button></td>'
          + '<td class="score">' + (r.score || "—") + '</td>'
          + '<td><span class="band b' + r.band + '">' + (r.band || "수기") + '</span></td>'
          + '<td class="cat">' + r.categoryLabel + '</td>'
          + '<td class="answers">' + r.answers + '</td>'
          + '<td class="desc">' + r.desc + '</td>'
          + '<td class="stages">' + (r.stages.join(", ") || "—") + '</td>'
          + '<td class="id">' + r.fullId + '</td>'
          + '</tr>';
      }).join("")
    : '<tr class="empty-row"><td colspan="8">조건에 맞는 버그가 없습니다.</td></tr>';

  document.getElementById("cutcount").textContent = cuts.size;
  document.getElementById("tray").classList.toggle("empty", cuts.size === 0);
  renderStats(rows);
}

function sortBy(k) {
  sortDir = sortKey === k ? -sortDir : 1;
  sortKey = k;
  render();
}

document.addEventListener("click", function (e) {
  const chip = e.target.closest(".chip");
  if (chip) {
    const f = chip.dataset.f, v = chip.dataset.v;
    if (f === "cat") {
      if (filters.cat.has(v)) { filters.cat.delete(v); } else { filters.cat.add(v); }
      chip.setAttribute("aria-pressed", String(filters.cat.has(v)));
    } else {
      filters[f] = v;
      document.querySelectorAll('.chip[data-f="' + f + '"]').forEach(function (c) {
        c.setAttribute("aria-pressed", String(c.dataset.v === v));
      });
    }
    render();
    return;
  }
  const cut = e.target.closest(".cutbtn");
  if (cut) {
    const id = cut.dataset.id;
    if (cuts.has(id)) { cuts.delete(id); } else { cuts.add(id); }
    save();
    render();
    return;
  }
  const th = e.target.closest("th[data-sort]");
  if (th) sortBy(th.dataset.sort);
});

document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter" && e.key !== " ") return;
  const th = e.target.closest("th[data-sort]");
  if (th) { e.preventDefault(); sortBy(th.dataset.sort); }
});

document.getElementById("q").addEventListener("input", render);
document.getElementById("clear").addEventListener("click", function () {
  cuts.clear(); save(); render();
});
document.getElementById("copy").addEventListener("click", function () {
  const text = [...cuts].sort().map(function (id) { return '  "' + id + '",'; }).join("\\n");
  const btn = document.getElementById("copy");
  navigator.clipboard.writeText(text).then(function () {
    btn.textContent = "복사됨";
  }, function () {
    btn.textContent = "복사 실패 — 콘솔에 출력함";
    console.log(text);
  });
  setTimeout(function () { btn.textContent = "exclusions.ts 형식으로 복사"; }, 1600);
});

render();
</script>`;

fs.writeFileSync(path.join("docs", "bug-review.html"), html, "utf8");
console.log(`wrote docs/bug-review.html (${rows.length} rows)`);
