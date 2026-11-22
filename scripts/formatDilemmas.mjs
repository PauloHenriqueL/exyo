// Formata content/dilemmas.json no estilo do arquivo (objetos pequenos numa linha só),
// para que edições feitas por script ou pelo editor de grafo gerem diffs pequenos.
// Uso como módulo: import { formatDilemmas } from "./formatDilemmas.mjs"
// Uso direto:      node scripts/formatDilemmas.mjs   (reformata o arquivo no lugar)
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Valor numa linha só: { "a": 1, "b": 2 }, [{ "card": "x" }]. */
export function inline(v) {
  if (Array.isArray(v)) return `[${v.map(inline).join(", ")}]`;
  if (v && typeof v === "object") {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    if (!entries.length) return "{}";
    return `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(", ")} }`;
  }
  return JSON.stringify(v);
}

const VARIANT_KEYS = ["when", "text", "effects", "setFlags", "inject"];
const CARD_KEYS = ["id", "kind", "category", "title", "prompt", "question", "requires", "openVote", "placement"];

function variantLines(v, pad) {
  const keys = [...VARIANT_KEYS.filter((k) => k in v), ...Object.keys(v).filter((k) => !VARIANT_KEYS.includes(k))];
  return keys.filter((k) => v[k] !== undefined).map((k) => `${pad}${JSON.stringify(k)}: ${inline(v[k])}`).join(",\n");
}

function outcomeBlock(name, variants) {
  if (variants.length === 1) {
    return `        ${JSON.stringify(name)}: [{\n${variantLines(variants[0], "          ")}\n        }]`;
  }
  const body = variants.map((v) => `          {\n${variantLines(v, "            ")}\n          }`).join(",\n");
  return `        ${JSON.stringify(name)}: [\n${body}\n        ]`;
}

function cardBlock(c) {
  const keys = [...CARD_KEYS.filter((k) => k in c), ...Object.keys(c).filter((k) => !CARD_KEYS.includes(k) && k !== "outcomes")];
  const lines = keys.filter((k) => c[k] !== undefined).map((k) => `      ${JSON.stringify(k)}: ${inline(c[k])}`);
  const outs = ["yes", "no", "tie", ...Object.keys(c.outcomes).filter((o) => !["yes", "no", "tie"].includes(o))]
    .filter((o) => c.outcomes[o])
    .map((o) => outcomeBlock(o, c.outcomes[o]));
  lines.push(`      "outcomes": {\n${outs.join(",\n")}\n      }`);
  return `    {\n${lines.join(",\n")}\n    }`;
}

export function formatDilemmas(file) {
  const top = Object.keys(file).filter((k) => k !== "dilemmas").map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(file[k])}`);
  return `{\n${top.join(",\n")},\n  "dilemmas": [\n${file.dilemmas.map(cardBlock).join(",\n")}\n  ]\n}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = new URL("../content/dilemmas.json", import.meta.url);
  writeFileSync(path, formatDilemmas(JSON.parse(readFileSync(path, "utf8"))));
}
