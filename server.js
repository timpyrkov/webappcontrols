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
// Only styles that have a full JS implementation
const READY_STYLES = new Set(["flat"]);

// Files common to every style export (relative to public/)
const COMMON_FILES = [
  "css/tokens.css",
  "js/tokens.js",
  "js/palette_tools.js",
  "js/palettes.js",
  "js/i18n.js",
];
// JS control modules for flat style
const FLAT_CONTROLS = [
  "js/controls/flat.js",
  "js/controls/rotary-knob.js",
  "js/controls/gauges.js",
];

function _generateStyleReadme(style, fileList) {
  const cap = style.charAt(0).toUpperCase() + style.slice(1);
  return `# Web App Controls — ${cap} Style

## Exported files

${fileList.map((f) => "- `" + f + "`").join("\n")}

## Quick start

1. Copy all exported files into your project, keeping the directory structure.

2. In your HTML \`<head>\`, load the CSS files:

\`\`\`html
<link rel="stylesheet" href="css/tokens.css" />
<link rel="stylesheet" href="css/styles/${STYLE_CSS[style]}" />
\`\`\`

3. At the bottom of \`<body>\` (or as ES modules), load the JS:

\`\`\`html
<script type="module" src="js/controls/${style}.js"></script>
<script type="module" src="js/controls/rotary-knob.js"></script>
<script type="module" src="js/controls/gauges.js"></script>
\`\`\`

4. Use the custom elements in your HTML:

\`\`\`html
<push-button label="Click me"></push-button>
<toggle-switch label="WiFi"></toggle-switch>
<segmented-control values='["A","B","C"]' value="A" columns="3"></segmented-control>
<rotary-knob mode="continuous" min="0" max="100" value="50" label="Volume" flat></rotary-knob>
<circular-gauge value="60" min="0" max="100" label="Speed"></circular-gauge>
<linear-gauge value="45" min="0" max="100" direction="horizontal" label="Level"></linear-gauge>
<bar-chart title="Revenue" data="[[40,60,80,50]]" labels='["Q1","Q2","Q3","Q4"]'></bar-chart>
<line-chart title="Trend" data="[[10,30,20,50,40]]" labels='["A","B","C","D","E"]'></line-chart>
<date-calendar value="2025-01-15"></date-calendar>
\`\`\`

## Required CSS custom properties

Your project must define the following CSS custom properties on \`:root\`
(or use \`js/gen_colors.js\` to generate them from a palette seed).

### Backgrounds & foregrounds (theme-dependent)

| Property        | Description                       | Example (dark)  | Example (light) |
|-----------------|-----------------------------------|-----------------|-----------------|
| \`--bg\`          | Page / component background       | \`#181610\`       | \`#f4f0e8\`       |
| \`--fg\`          | Primary text colour               | \`#e8e4d8\`       | \`#282420\`       |
| \`--panel-bg\`    | Card / panel background           | \`#201e18\`       | \`#eae6de\`       |
| \`--panel-edge\`  | Panel border colour               | \`#302c25\`       | \`#d0ccc0\`       |
| \`--edge-1\`      | Subtle border / divider           | \`#302c25\`       | \`#c8c4b8\`       |
| \`--edge-2\`      | Stronger border                   | \`#484030\`       | \`#b0a898\`       |

### Neutrals

| Property         | Description          |
|------------------|----------------------|
| \`--neutral-1\`    | Subtle surface fill  |
| \`--neutral-2\`    | Stronger fill        |
| \`--neutral-3\`    | Mid neutral          |
| \`--neutral-4\`    | High neutral         |

### Accent colours

Primary accents (\`--primary-accent-1\` through \`--primary-accent-5\` or up to 7):

| Property               | Usage                          |
|------------------------|--------------------------------|
| \`--primary-accent-1\`   | Darkest primary accent         |
| \`--primary-accent-3\`   | Mid primary (buttons, toggles) |
| \`--primary-accent-5\`   | Brightest primary              |

Secondary accents (\`--secondary-accent-1\` through \`--secondary-accent-5\`):

| Property                 | Usage                        |
|--------------------------|------------------------------|
| \`--secondary-accent-1\`   | Darkest secondary accent     |
| \`--secondary-accent-3\`   | Mid secondary                |
| \`--secondary-accent-5\`   | Brightest secondary          |

### Semantic / notification colours

| Property            | Usage          |
|---------------------|----------------|
| \`--color-note\`      | Info / note    |
| \`--color-message\`   | Message        |
| \`--color-success\`   | Success        |
| \`--color-warning\`   | Warning        |
| \`--color-error\`     | Error          |

### Font

| Property           | Description                      |
|--------------------|----------------------------------|
| \`--font-display\`   | Display font family for all text |

## Palette generation (optional)

Instead of defining colours manually, you can use the included
\`js/palette_tools.js\` and \`js/palettes.js\` modules:

\`\`\`js
import { PALETTES, DEFAULT_PALETTE } from "./js/palettes.js";
import { createPalette } from "./js/palette_tools.js";

const palette = PALETTES[DEFAULT_PALETTE];
const result = createPalette({ main: palette.main, seeds: palette.accents });

// Choose a variant
const variant = result.darkTinted;   // or lightTinted
// variant.neutrals[], variant.primary[], variant.secondary[],
// variant.notifications{}, variant.categories[]

// Apply to CSS
for (const n of variant.neutrals)  root.setProperty(\`--\${n.label}\`, n.hex);
for (const p of variant.primary)   root.setProperty(\`--\${p.label}\`, p.hex);
for (const s of variant.secondary) root.setProperty(\`--\${s.label}\`, s.hex);
\`\`\`

## Internationalization (i18n)

The \`js/i18n.js\` module provides lightweight translation support.

\`\`\`js
import { loadLanguage, t } from "./js/i18n.js";

// Load a language (fetches i18n/<lang>.json)
await loadLanguage("de");

// Translate a key
const label = t("btn.save"); // "Speichern"
\`\`\`

Add \`data-i18n\`, \`data-i18n-label\`, \`data-i18n-title\`, or
\`data-i18n-values\` attributes to HTML elements for automatic
DOM translation when \`loadLanguage()\` is called.

### Supported languages

| Code | Language   |
|------|------------|
| en   | English    |
| es   | Spanish    |
| it   | Italian    |
| fr   | French     |
| de   | German     |
| ru   | Russian    |
| ko   | Korean     |
| ja   | Japanese   |
| zh   | Chinese    |

## Dark / Light theme switching

Define two sets of CSS custom properties (one for dark, one for light)
and swap them when the user toggles themes. The \`generatePalette()\`
function returns both \`result.dark\` and \`result.light\` token maps.

---

*Generated by webappcontrols export — ${new Date().toISOString().split("T")[0]}*
`;
}

app.get("/api/export-style", (req, res) => {
  const style = (req.query.style || "flat").toLowerCase();
  if (!READY_STYLES.has(style)) {
    return res.status(400).json({ ok: false, error: `Style "${style}" is not yet available for export.` });
  }

  const pub = path.join(__dirname, "public");
  const cssFile = `css/styles/${STYLE_CSS[style]}`;
  const files = [...COMMON_FILES, cssFile, ...FLAT_CONTROLS];

  // Add i18n JSON files
  const i18nDir = path.join(pub, "i18n");
  let i18nFiles = [];
  try {
    i18nFiles = fs.readdirSync(i18nDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => `i18n/${f}`);
  } catch { /* ignore */ }

  const allFiles = [...files, ...i18nFiles];

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="webappcontrols-${style}.zip"`);

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => res.status(500).send({ error: err.message }));
  archive.pipe(res);

  for (const relPath of allFiles) {
    const absPath = path.join(pub, relPath);
    if (fs.existsSync(absPath)) {
      archive.file(absPath, { name: relPath });
    }
  }

  // Generate and include STYLE_README.md
  const readme = _generateStyleReadme(style, allFiles);
  archive.append(readme, { name: "STYLE_README.md" });

  archive.finalize();
});

/* ── Static files ────────────────────────────────────────────── */

app.use(express.static(path.join(__dirname, "public")));

/* ── Start ───────────────────────────────────────────────────── */

app.listen(PORT, () => {
  console.log(`✓ Dev server running at http://localhost:${PORT}`);
});
