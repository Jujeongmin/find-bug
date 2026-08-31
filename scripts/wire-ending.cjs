const fs = require("fs");
const miss = [];
const swap = (s, a, b, tag) => { if (!s.includes(a)) { miss.push(tag); return s; } return s.split(a).join(b); };

let a = fs.readFileSync("src/App.tsx", "utf8");
a = swap(a, 'import { useProgress } from "./net/useProgress";',
  'import { useProgress } from "./net/useProgress";\nimport { EndingScreen } from "./components/EndingScreen";', "import");
a = swap(a, '  const [playing, setPlaying] = useState<number | null>(null);',
  '  const [playing, setPlaying] = useState<number | null>(null);\n  /** shown right after the last build is signed off */\n  const [showEnding, setShowEnding] = useState(false);', "state");
a = swap(a,
  "  const onClear = () => {\n    if (stage) reportClear(stage.n);\n    setPlaying(null);\n  };",
  "  const onClear = () => {\n    if (stage) {\n      reportClear(stage.n);\n      if (stage.n >= CURRICULUM.length) setShowEnding(true);\n    }\n    setPlaying(null);\n  };", "onClear");
a = swap(a, "        {playing === null && (\n          <div className=\"title-screen wide\">",
  "        {showEnding && (\n          <EndingScreen\n            total={CURRICULUM.length}\n            onBackToTitle={() => setShowEnding(false)}\n          />\n        )}\n\n        {playing === null && !showEnding && (\n          <div className=\"title-screen wide\">", "render");
/* finished players get a way back to the ending */
a = swap(a, "            <p className=\"progress-line\">\n              {t(\"game.progress\")}: {cleared} / {CURRICULUM.length}\n            </p>",
  "            <p className=\"progress-line\">\n              {t(\"game.progress\")}: {cleared} / {CURRICULUM.length}\n              {cleared >= CURRICULUM.length && (\n                <button className=\"link-btn\" onClick={() => setShowEnding(true)}>\n                  {t(\"ending.replay\")}\n                </button>\n              )}\n            </p>", "replay link");
fs.writeFileSync("src/App.tsx", a);

const COPY = {
  ko: {
    "ending.eyebrow": "빌드 검증 완료",
    "ending.title": "출시했다",
    "ending.lead": "{total}개 빌드를 전부 검증했다. 마지막 결함까지 잡아내고, 게임은 예정대로 출시됐다.",
    "ending.stat.builds": "검증한 빌드",
    "ending.stat.shipped": "출시한 게임",
    "ending.note": "출시 노트에 당신 이름은 없다. 대신 버그 리포트가 하나도 안 올라왔다.",
    "ending.back": "타이틀로",
    "ending.replay": "엔딩 다시 보기",
  },
  en: {
    "ending.eyebrow": "QA complete",
    "ending.title": "It shipped",
    "ending.lead": "All {total} builds verified. You caught the last defect, and the game went out on schedule.",
    "ending.stat.builds": "Builds verified",
    "ending.stat.shipped": "Game shipped",
    "ending.note": "Your name isn't in the release notes. But not a single bug report came in.",
    "ending.back": "Back to title",
    "ending.replay": "Replay ending",
  },
};
for (const [lang, vals] of Object.entries(COPY)) {
  const p = "src/i18n/" + lang + ".json";
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  Object.assign(d, vals);
  fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n", "utf8");
}
console.log(miss.length ? "MISSED: " + miss.join(", ") : "ok");
