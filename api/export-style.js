const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const STYLE_CSS = {
  flat: "flat.css", glow: "glow.css", gradient: "gradient.css",
  volume: "volume.css",
};
// All four styles share flat.js (only their CSS differs)
const READY_STYLES = new Set(["flat", "glow", "gradient", "volume"]);

const COMMON_FILES = [
  "css/tokens.css",
  "js/tokens.js",
  "js/gen_colors.js",
  "js/palette_tools.js",
  "js/palettes.js",
  "js/i18n.js",
  "js/controls/flat.js",
  "js/controls/rotary-knob.js",
  "js/controls/gauges.js",
];

module.exports = (req, res) => {
  const style = (req.query.style || "flat").toLowerCase();
  if (!READY_STYLES.has(style)) {
    return res.status(400).json({ ok: false, error: `Style "${style}" is not yet available for export.` });
  }

  const root = process.cwd();
  const pub = path.join(root, "public");
  const cssFile = `css/styles/${STYLE_CSS[style]}`;
  const files = [...COMMON_FILES, cssFile];

  // Add all i18n JSON files
  const i18nDir = path.join(pub, "i18n");
  let i18nFiles = [];
  try {
    i18nFiles = fs.readdirSync(i18nDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => `i18n/${f}`);
  } catch { /* ignore */ }

  const cap = style.charAt(0).toUpperCase() + style.slice(1);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${cap}_modules.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => res.status(500).send({ error: err.message }));
  archive.pipe(res);

  // 1) Module files (under public/) keep their relative paths inside the zip
  for (const relPath of [...files, ...i18nFiles]) {
    const absPath = path.join(pub, relPath);
    if (fs.existsSync(absPath)) archive.file(absPath, { name: relPath });
  }

  // 2) Integration docs at the zip root
  for (const docName of ["STYLES.md", "PROMPT.md"]) {
    const absPath = path.join(pub, "data", docName);
    if (fs.existsSync(absPath)) archive.file(absPath, { name: docName });
  }

  // 3) License at the zip root
  const licensePath = path.join(root, "LICENSE");
  if (fs.existsSync(licensePath)) archive.file(licensePath, { name: "LICENSE" });

  archive.finalize();
};
