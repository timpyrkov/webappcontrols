const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Version info from git tag ────────────────────────────────── */

const { execSync } = require("child_process");

app.get("/api/version", (_req, res) => {
  try {
    const tag = execSync("git describe --tags --abbrev=0", { encoding: "utf8" }).trim();
    const msg = execSync(`git tag -l --format='%(contents)' ${tag}`, { encoding: "utf8" }).trim();
    res.json({ tag, message: msg });
  } catch {
    res.json({ tag: "dev", message: "" });
  }
});

/* ── Style export as zip ──────────────────────────────────────── */

const fs = require("fs");
const archiver = require("archiver");

// Map from style key to CSS filename
const STYLE_CSS = {
  flat: "flat.css", glow: "glow.css", gradient: "gradient.css",
  volume: "volume.css",
};
// All four styles share flat.js (only their CSS differs)
const READY_STYLES = new Set(["flat", "glow", "gradient", "volume"]);

// Files common to every style export (relative to public/)
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

app.get("/api/export-style", (req, res) => {
  const style = (req.query.style || "flat").toLowerCase();
  if (!READY_STYLES.has(style)) {
    return res.status(400).json({ ok: false, error: `Style "${style}" is not yet available for export.` });
  }

  const pub = path.join(__dirname, "public");
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
  const licensePath = path.join(__dirname, "LICENSE");
  if (fs.existsSync(licensePath)) archive.file(licensePath, { name: "LICENSE" });

  archive.finalize();
});

/* ── Static files ────────────────────────────────────────────── */

app.use(express.static(path.join(__dirname, "public")));

/* ── Start ───────────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`✓ Dev server running at http://localhost:${PORT}`);
});
