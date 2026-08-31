/**
 * Gives every curriculum slot its own name.
 *
 * The names follow the framing story — a build timeline running from the first
 * internal build to the final sign-off — rather than the scene they land on.
 * Scene assignment is generated and can shift when bug pools change, so a
 * scene-specific name would eventually end up on the wrong scene.
 */
const fs = require("fs");

const NAMES = [
  ["첫 빌드 점검", "First Build Check"],
  ["초기 알파", "Early Alpha"],
  ["내부 알파", "Internal Alpha"],
  ["알파 하드닝", "Alpha Hardening"],
  ["알파 승인", "Alpha Sign-off"],
  ["베타 진입", "Beta Entry"],
  ["베타 1주차", "Beta Week One"],
  ["회귀 점검", "Regression Check"],
  ["리그레션 스윕", "Regression Sweep"],
  ["마일스톤 검수", "Milestone Review"],
  ["콘텐츠 락", "Content Lock"],
  ["밸런스 패스", "Balance Pass"],
  ["성능 패스", "Performance Pass"],
  ["베타 마감", "Beta Close"],
  ["릴리스 후보 1", "Release Candidate 1"],
  ["RC1 재검", "RC1 Recheck"],
  ["RC2", "RC2"],
  ["심사 대비", "Cert Prep"],
  ["스토어 심사 빌드", "Store Review Build"],
  ["심사 반려 대응", "Cert Rejection Fix"],
  ["핫픽스 검증", "Hotfix Verification"],
  ["골드 마스터 준비", "Gold Master Prep"],
  ["GM 후보", "GM Candidate"],
  ["GM 재검", "GM Recheck"],
  ["출시 D-7", "Launch D-7"],
  ["출시 D-3", "Launch D-3"],
  ["출시 D-1", "Launch D-1"],
  ["출시 당일 빌드", "Launch Day Build"],
  ["라이브 핫픽스", "Live Hotfix"],
  ["최종 사인오프", "Final Sign-off"],
];

for (const [lang, idx] of [["ko", 0], ["en", 1]]) {
  const p = "src/i18n/" + lang + ".json";
  const d = JSON.parse(fs.readFileSync(p, "utf8"));
  NAMES.forEach((pair, i) => {
    d["stage.build." + String(i + 1).padStart(2, "0")] = pair[idx];
  });
  fs.writeFileSync(p, JSON.stringify(d, null, 2) + "\n", "utf8");
}
console.log("wrote " + NAMES.length + " stage names");
