/**
 * Does any text break out of the box it was given, in any language?
 *
 * Switches language by clicking the buttons in the settings panel, so it
 * measures the real cascade rather than a guess about it. Korean and Chinese
 * are dense, English and Japanese are not, and a bar that fits one of them
 * says nothing about the other three.
 *
 * Only elements that carry their own text are measured. Two things looked like
 * faults on the first run and were not: a sprite bar whose border makes
 * scrollWidth exceed clientWidth by a few pixels with no text in it at all, and
 * an absolutely-positioned panel inflating the shrink-wrapped box it hangs off.
 * Neither can be a translation problem, and a probe that cries about them is a
 * probe nobody reads.
 */
window.__overflow = async function overflow(waitMs = 400) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = document.querySelector(".app-frame").getBoundingClientRect();
  const langs = [...document.querySelectorAll(".settings-langs button")];
  if (!langs.length) throw new Error("open the settings panel first");
  const report = {};

  /** text of its own, rather than text belonging to something inside it */
  const owns = (el) =>
    [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const floats = (el) =>
    [...el.children].some((c) => getComputedStyle(c).position === "absolute");

  for (const button of langs) {
    button.click();
    await sleep(waitMs);
    const bad = [];
    for (const el of document.querySelectorAll(".app-frame *")) {
      if (!owns(el)) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;

      if (r.right > frame.right + 1 || r.left < frame.left - 1) {
        bad.push(`밖으로 ${Math.round(Math.max(r.right - frame.right, frame.left - r.left))}px  ${tag(el)}`);
        continue;
      }
      const scrolls = /auto|scroll/.test(style.overflowX + style.overflowY);
      if (scrolls || floats(el)) continue;
      if (el.scrollWidth > el.clientWidth + 1) {
        bad.push(`가로 넘침 ${el.scrollWidth - el.clientWidth}px  ${tag(el)}`);
      } else if (el.scrollHeight > el.clientHeight + 1) {
        bad.push(`세로 넘침 ${el.scrollHeight - el.clientHeight}px  ${tag(el)}`);
      }
    }
    report[button.innerText] = bad.length ? bad : "없음";
  }
  return report;

  function tag(el) {
    const cls = (el.className || "").toString().trim().split(/\s+/)[0];
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} "${(el.textContent || "").trim().slice(0, 30)}"`;
  }
};
