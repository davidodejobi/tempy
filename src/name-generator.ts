import { randomInt } from "node:crypto";

// Curated, lowercase-ascii words for readable email local-parts:
// landmarks, objects, and themes (no people's names).
const WORDS: string[] = [
  "zuma", "aso", "olumo", "idanre", "gurara", "yankari", "obudu", "kainji",
  "mambilla", "lekki", "ogbunike", "agbokim", "niger", "benue", "calabar",
  "jollof", "suya", "garri", "egusi", "akara", "moimoi", "kola", "adire",
  "agbada", "ankara", "calabash", "shekere", "gangan", "udu",
  "parthenon", "acropolis", "olympus", "aegean", "santorini", "meteora",
  "knossos", "ithaca", "agora", "amphora", "delphi", "olympia", "corinth",
  "kosmos", "zephyr", "lithos", "thalassa", "kairos", "chronos",
  "olive", "laurel", "lyre", "mosaic", "marble", "scroll",
  "lantern", "compass", "anchor", "beacon", "summit", "canyon", "delta",
  "oasis", "cedar", "cobalt", "indigo", "onyx", "lumen", "vesper", "river",
  "meadow", "basalt", "quartz", "amber", "copper", "ember", "willow", "ivory",
];

// Generates a readable, lowercase-alphanumeric local-part like "sankofadelphi42".
// Two words crunched together plus a 0-99 suffix. Crypto-backed selection.
export function generateLocalPart(): string {
  const a = WORDS[randomInt(WORDS.length)];
  let b = WORDS[randomInt(WORDS.length)];
  if (b === a) b = WORDS[(WORDS.indexOf(a) + 1) % WORDS.length];
  const suffix = randomInt(100); // 0-99
  return `${a}${b}${suffix}`;
}
