/**
 * Is there an arrow in the sheet already?
 *
 * Scans every tile for a shape that narrows monotonically downward to a point:
 * a wide top row, each row no wider than the one above, and a tip a pixel or
 * three across. Cheaper than looking at seventeen hundred tiles.
 */
window.__findArrow = async function findArrow(sheet = "roguelike", tile = 16, step = 17, cols = 57, rows = 31) {
  const img = new Image();
  img.src = `/src/assets/sheets/${sheet}.png`;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = tile;
  c.height = tile;
  const g = c.getContext("2d");
  const hits = [];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      g.clearRect(0, 0, tile, tile);
      g.drawImage(img, col * step, r * step, tile, tile, 0, 0, tile, tile);
      const d = g.getImageData(0, 0, tile, tile).data;
      const w = [];
      let op = 0;
      for (let y = 0; y < tile; y++) {
        let n = 0;
        for (let x = 0; x < tile; x++) {
          if (d[(y * tile + x) * 4 + 3] > 8) { n++; op++; }
        }
        w.push(n);
      }
      if (op < 12 || op > 110) continue;
      const nz = w.map((n, i) => [n, i]).filter((p) => p[0] > 0);
      if (nz.length < 4) continue;
      const top = nz[0][1];
      const bot = nz[nz.length - 1][1];
      let narrowing = true;
      for (let i = top + 1; i <= bot; i++) {
        if (w[i] > w[i - 1]) { narrowing = false; break; }
      }
      if (!narrowing || w[bot] > 3 || w[top] < 5) continue;
      hits.push(`${col},${r}  ${op}px  [${w.slice(top, bot + 1).join(",")}]`);
    }
  }
  return hits;
};
