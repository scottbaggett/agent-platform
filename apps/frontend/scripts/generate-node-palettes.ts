// scripts/generate-node-palettes.mjs
// Usage: node scripts/generate-node-palettes.mjs
// Generates:
// - src/node-palettes.css with semantic tokens per node color
// - src/shared/components/workflowEditor/store/saltWorkflowSlice/NodeConfig/generated/nodeColors.ts

import fs from "node:fs";
import path from "node:path";
import { Poline, positionFunctions } from "poline";

// Define color sets
const COLOR_SETS = {
  standard: {
    name: "Standard",
    description: "Classic color palette",
    colors: [
      { name: "gray", hue: 245, saturation: 0.1 },
      { name: "red", hue: 0, saturation: 0.7 },
      { name: "orange", hue: 30, saturation: 0.82 },
      { name: "yellow", hue: 45, saturation: 0.92 },
      { name: "green", hue: 135, saturation: 0.65 },
      { name: "teal", hue: 170, saturation: 0.72 },
      { name: "blue", hue: 220, saturation: 0.95 },
      { name: "purple", hue: 275, saturation: 0.67 },
      { name: "pink", hue: 330, saturation: 0.72 },
      { name: "brown", hue: 30, saturation: 0.45 },
      { name: "olive", hue: 90, saturation: 0.4 },
      { name: "peach", hue: 20, saturation: 0.6 },
      { name: "mint", hue: 120, saturation: 0.5 },
      { name: "sky", hue: 200, saturation: 0.7 },
    ],
  },
  solid: {
    name: "Solid",
    description: "Solid colors with dark text",
    inverted: true, // This set will have inverted lightness
    colors: [
      { name: "white", hue: 265, saturation: 0.01, inverted: true },
      { name: "red", hue: 0, saturation: 0.85, inverted: true },
      { name: "orange", hue: 30, saturation: 0.9, inverted: true },
      { name: "yellow", hue: 45, saturation: 0.95, inverted: true },
      { name: "green", hue: 120, saturation: 1.0, inverted: true },
      { name: "cyan", hue: 180, saturation: 1.0, inverted: true },
      { name: "blue", hue: 240, saturation: 1.0, inverted: true },
      { name: "purple", hue: 300, saturation: 1.0, inverted: true },
    ],
  },
};

// Generate a color theme configuration
function generateThemeConfig(name, hue, saturation, inverted = false) {
  const isGray = saturation < 0.1;
  const isLowSaturation = saturation < 0.25;

  // For inverted colors, we want bright backgrounds with dark text
  // So the anchors need to support the full range properly
  if (inverted) {
    // For low-saturation colors (white, grays), use very light backgrounds
    if (isLowSaturation) {
      return {
        name,
        anchors: [
          [hue, saturation * 0.3, 0.05], // Very dark (for text/borders)
          [hue, saturation * 0.5, 0.7], // Medium bright for sampling
          [hue, saturation * 0.01, 0.9998], // Nearly white for light mode
        ],
        posX: "linearPosition",
        posY: "linearPosition",
        posZ: "linearPosition",
      };
    }

    // For saturated colors, use vibrant mid-tones for backgrounds
    return {
      name,
      anchors: [
        [hue, saturation * 0.3, 0.05], // Very dark (for text/borders)
        [hue, saturation * 0.9, 0.65], // Vibrant color for backgrounds
        [hue, saturation * 0.2, 0.95], // Light for very light sampling
      ],
      posX: "linearPosition",
      posY: "linearPosition",
      posZ: "linearPosition",
    };
  }

  // Normal themes: light backgrounds, dark text
  return {
    name,
    anchors: [
      [hue, saturation, 0.96], // Light anchor
      [hue, isGray ? saturation : saturation + 0.05, 0.08], // Dark anchor
    ],
    posX: "linearPosition",
    posY: "sinusoidalPosition",
    posZ: "linearPosition",
  };
}

// Generate colors from anchor points using Poline
function generateColorsFromAnchors(setConfig) {
  const { anchors, count, posX, posY, posZ, inverted } = setConfig;

  // Create a Poline instance with the anchors
  const p = new Poline({
    anchorColors: anchors,
    numPoints: count,
    positionFunctionX: posX
      ? positionFunctions[posX]
      : positionFunctions.sinusoidalPosition,
    positionFunctionY: posY
      ? positionFunctions[posY]
      : positionFunctions.exponentialPosition,
    positionFunctionZ: posZ
      ? positionFunctions[posZ]
      : positionFunctions.linearPosition,
    closedLoop: true,
    invertedLightness: inverted || false,
  });

  const colors = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const color = p.getColorAt(t);
    const [h, s] = color.hsl;
    const name = `color${i + 1}`;
    colors.push({ name, hue: h, saturation: s });
  }
  return colors;
}

// Build all themes from color sets
function buildAllThemes() {
  const allThemes = {};

  for (const [setId, setConfig] of Object.entries(COLOR_SETS)) {
    const colors = setConfig.colors;

    for (const color of colors) {
      const themeKey = `${setId}_${color.name}`;
      // Use color-specific inverted flag if available, otherwise use set-wide flag
      const inverted =
        color.inverted !== undefined ? color.inverted : setConfig.inverted;
      allThemes[themeKey] = generateThemeConfig(
        color.name,
        color.hue,
        color.saturation,
        inverted,
      );
    }
  }

  return allThemes;
}

const themes = buildAllThemes();

// Sampling positions tuned for hierarchy and contrast.
const LIGHT_T = {
  node: 0.001, // very light background
  border: 0.3, // lighter border
  foreground: 0.9, // much darker text for contrast
  mutedForeground: 0.8, // very dark muted text
  highlight: 0.09, // medium for transparency
  input: 0.45, // darker for better border visibility in light mode
};
const DARK_T = {
  node: 0.9, // nearly black background
  border: 0.5, // bright border
  foreground: 0.05, // very light text for contrast
  mutedForeground: 0.3, // medium muted
  highlight: 0.14, // medium for transparency
  input: 0.35, // lighter for better border visibility in dark mode
};

// Inverted sampling positions for dark-on-light colors (solid backgrounds)
// With 3 anchors [0.05 L, 0.70 L, 0.9998 L], sample to hit target lightness values
const LIGHT_T_INVERTED = {
  node: 0.95, // ~100% lightness - sample from very light end
  border: 0.17, // ~26% lightness - medium dark border
  foreground: 0.0, // ~5% lightness - very dark text (start of curve)
  mutedForeground: 0.015, // ~7% lightness - dark muted text
  highlight: 0.07, // ~14% lightness - dark for transparency
  input: 0.7, // ~93% lightness - light input border
};
const DARK_T_INVERTED = {
  node: 0.78, // ~87% lightness - bright background in dark mode
  border: 0.015, // ~7% lightness - very dark border (near dark end)
  foreground: 0.015, // ~7% lightness - very dark text
  mutedForeground: 0.038, // ~11% lightness - dark muted text
  highlight: 0.6, // ~14% lightness - dark for transparency
  input: 0.5, // ~74% lightness - medium light input border
};

// HIGH SATURATION (vibrant colors): With 3 anchors [0.05 L, 0.65 L, 0.95 L]
const LIGHT_T_INVERTED_SATURATED = {
  node: 0.65, // ~70% lightness - vibrant color for light mode
  border: 0.32, // ~5% lightness - dark border
  foreground: 0.0, // ~5% lightness - very dark text
  mutedForeground: 0.02, // ~7% lightness - dark muted text
  highlight: 0.45, // ~15% lightness - dark for transparency
  input: 0.3, // ~93% lightness - light input border
};
const DARK_T_INVERTED_SATURATED = {
  node: 0.57, // ~65% lightness - vibrant color for dark mode
  border: 0.02, // ~7% lightness - very dark border
  foreground: 0.01, // ~5% lightness - very dark text
  mutedForeground: 0.04, // ~10% lightness - dark muted text
  highlight: 0.06, // ~12% lightness - dark for transparency
  input: 0.4, // ~60% lightness - medium input border
};

function buildPoline(cfg) {
  return new Poline({
    anchorColors: cfg.anchors,
    numPoints: 8,
    positionFunctionX: cfg.posX
      ? positionFunctions[cfg.posX]
      : positionFunctions.sinusoidalPosition,
    positionFunctionY: cfg.posY
      ? positionFunctions[cfg.posY]
      : positionFunctions.sinusoidalPosition,
    positionFunctionZ: cfg.posZ
      ? positionFunctions[cfg.posZ]
      : positionFunctions.sinusoidalPosition,
    closedLoop: false,
    invertedLightness: false,
  });
}

function sampleAt(poline, t) {
  return poline.getColorAt(t).hslCSS;
}

function varsForLight(p, inverted = false, saturation = 1.0) {
  // Choose sampling positions based on saturation level
  let T;
  if (inverted) {
    T = saturation < 0.25 ? LIGHT_T_INVERTED : LIGHT_T_INVERTED_SATURATED;
  } else {
    T = LIGHT_T;
  }

  const vars = {
    "--color-node": sampleAt(p, T.node),
    "--color-node-foreground": sampleAt(p, T.foreground),
    "--color-node-border": sampleAt(p, T.border),
  };

  // For muted foreground, desaturate it by reducing saturation
  const mutedFgColor = p.getColorAt(T.mutedForeground);
  const [mfH, mfS, mfL] = mutedFgColor.hsl;
  const desaturatedS = inverted ? mfS : mfS * 0.3; // Reduce saturation to 30% for standard colors
  vars["--color-node-muted-foreground"] =
    `hsl(${Math.round(mfH)}, ${Math.round(desaturatedS * 100)}%, ${Math.round(mfL * 100)}%)`;

  // Add semi-transparent highlight and input colors
  const highlightColor = p.getColorAt(T.highlight);
  const [h1, s1, l1] = highlightColor.hsl;
  // Special case for very bright colors: use much lower opacity
  const nodeColor = p.getColorAt(T.node);
  const isBright = nodeColor.hsl[2] > 0.92;
  const highlightOpacity = isBright ? 0.15 : inverted ? 0.75 : 1;
  vars["--color-node-highlight"] =
    `hsla(${Math.round(h1)}, ${Math.round(s1 * 70)}%, ${Math.round(l1 * 100)}%, ${highlightOpacity})`;

  const inputColor = p.getColorAt(T.input);
  const [h2, s2, l2] = inputColor.hsl;
  const inputOpacity = inverted ? 1.0 : 0.6;
  vars["--color-node-input"] =
    `hsla(${Math.round(h2)}, ${Math.round(s2 * 100)}%, ${Math.round(l2 * 100)}%, ${inputOpacity})`;

  return vars;
}
function varsForDark(p, inverted = false, saturation = 1.0) {
  // Choose sampling positions based on saturation level
  let T;
  if (inverted) {
    T = saturation < 0.25 ? DARK_T_INVERTED : DARK_T_INVERTED_SATURATED;
  } else {
    T = DARK_T;
  }

  const nodeSecondaryColor = p.getColorAt(T.nodeSecondary);
  const [nsH, nsS, nsL] = nodeSecondaryColor.hsl;

  const vars = {
    "--color-node": sampleAt(p, T.node),
    "--color-node-foreground": sampleAt(p, T.foreground),
    "--color-node-border": sampleAt(p, T.border),
  };

  // For muted foreground, desaturate it by reducing saturation
  const mutedFgColor = p.getColorAt(T.mutedForeground);
  const [mfH, mfS, mfL] = mutedFgColor.hsl;
  const desaturatedS = inverted ? mfS : mfS * 0.3; // Reduce saturation to 30% for standard colors
  vars["--color-node-muted-foreground"] =
    `hsl(${Math.round(mfH)}, ${Math.round(desaturatedS * 100)}%, ${Math.round(mfL * 90)}%)`;

  // Add semi-transparent highlight and input colors
  const highlightColor = p.getColorAt(T.highlight);
  const [hH, hS, hL] = highlightColor.hsl;
  const highlightOpacity = inverted ? 0.25 : 0.457;
  vars["--color-node-highlight"] =
    `hsla(${Math.round(hH)}, ${Math.round(hS * 100)}%, ${Math.round(hL * 50)}%, ${highlightOpacity})`;

  const inputColor = p.getColorAt(T.input);
  const [iH, iS, iL] = inputColor.hsl;
  const inputOpacity = 1;
  vars["--color-node-input"] =
    `hsla(${Math.round(iH)}, ${Math.round(iS * 100)}%, ${Math.round(iL * 50)}%, ${inputOpacity})`;

  return vars;
}

function makeCssBlock(selector, vars) {
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  return `${selector} {\n${lines.join("\n")}\n}\n`;
}

function generateCss() {
  let css = "";

  // Generate CSS for each color in each set
  for (const [setId, setConfig] of Object.entries(COLOR_SETS)) {
    const colors = setConfig.colors;

    css += `/* ===== ${setConfig.name} Color Set ===== */\n`;
    css += `/* ${setConfig.description} */\n\n`;

    for (const color of colors) {
      const themeKey = `${setId}_${color.name}`;
      const theme = themes[themeKey];
      const p = buildPoline(theme);
      const inverted =
        color.inverted !== undefined ? color.inverted : setConfig.inverted;
      const saturation = color.saturation;
      const lightVars = varsForLight(p, inverted, saturation);
      const darkVars = varsForDark(p, inverted, saturation);

      const cssClass = `${setId}-${color.name}`;
      css += `/* ${color.name} (${setConfig.name} set) */\n`;
      css += makeCssBlock(`.light [data-node-color='${cssClass}']`, lightVars);
      css += makeCssBlock(`.dark [data-node-color='${cssClass}']`, darkVars);
      css += "\n";
    }
  }

  return css;
}

function generateTypeScript() {
  let ts = `// Generated by scripts/generate-node-palettes.mjs\n`;
  ts += `// DO NOT EDIT MANUALLY\n\n`;

  // Generate enum
  ts += `export enum NodeColor {\n`;
  for (const [setId, setConfig] of Object.entries(COLOR_SETS)) {
    const colors = setConfig.colors;

    for (const color of colors) {
      const enumKey = `${setId}_${color.name}`.toUpperCase().replace(/-/g, "_");
      const enumValue = `${setId}-${color.name}`;
      ts += `  ${enumKey} = '${enumValue}',\n`;
    }
  }
  ts += `}\n\n`;

  // Generate color sets metadata
  ts += `export interface ColorSet {\n`;
  ts += `  id: string;\n`;
  ts += `  name: string;\n`;
  ts += `  description: string;\n`;
  ts += `  colors: NodeColor[];\n`;
  ts += `}\n\n`;

  ts += `export const COLOR_SETS: ColorSet[] = [\n`;
  for (const [setId, setConfig] of Object.entries(COLOR_SETS)) {
    const colors = setConfig.colors;

    ts += `  {\n`;
    ts += `    id: '${setId}',\n`;
    ts += `    name: '${setConfig.name}',\n`;
    ts += `    description: '${setConfig.description}',\n`;
    ts += `    colors: [\n`;
    for (const color of colors) {
      const enumKey = `${setId}_${color.name}`.toUpperCase().replace(/-/g, "_");
      ts += `      NodeColor.${enumKey},\n`;
    }
    ts += `    ],\n`;
    ts += `  },\n`;
  }
  ts += `];\n\n`;

  // Default selections
  ts += `export const DEFAULT_SELECTABLE_NODE_COLORS = COLOR_SETS[0].colors;\n\n`;
  ts += `export const NODE_COLOR_DEFAULT = NodeColor.STANDARD_GRAY;\n\n`;

  // Helper functions
  ts += `const NodeColorSet = new Set(Object.values(NodeColor) as string[]);\n`;
  ts += `export const isNodeColor = (value?: string): value is NodeColor => !!value && NodeColorSet.has(value);\n\n`;

  ts += `export const getRandomColor = (): NodeColor => {\n`;
  ts += `  const colors = Object.values(NodeColor);\n`;
  ts += `  return colors[Math.floor(Math.random() * colors.length)];\n`;
  ts += `};\n`;

  return ts;
}

function main() {
  // Generate CSS
  const cssOutDir = path.resolve("src/styles");
  const cssOutFile = path.join(cssOutDir, "node-palettes.css");
  fs.mkdirSync(cssOutDir, { recursive: true });
  fs.writeFileSync(cssOutFile, generateCss(), "utf8");
  console.log(`✓ Wrote ${cssOutFile}`);

  // Generate TypeScript
  const tsOutDir = path.resolve("src/lib/");
  const tsOutFile = path.join(tsOutDir, "nodeColors.ts");
  fs.mkdirSync(tsOutDir, { recursive: true });
  fs.writeFileSync(tsOutFile, generateTypeScript(), "utf8");
  console.log(`✓ Wrote ${tsOutFile}`);
}

main();
s;
