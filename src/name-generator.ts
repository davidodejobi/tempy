import { randomInt } from "node:crypto";

// Curated, lowercase-ascii words for readable email local-parts.
// A mix of Nigerian (Yoruba / Igbo / Hausa), Greek, and a few general words.
const WORDS: string[] = [
  // Yoruba
  "ayanfe", "ife", "oluwa", "ade", "ayo", "bisi", "funmi", "ireti", "jide",
  "kemi", "lola", "segun", "titi", "wale", "yemi", "sade", "tunde", "bola",
  // Igbo
  "chukwu", "ada", "obi", "emeka", "ngozi", "chidi", "ifeoma", "nneka",
  "uche", "kelechi", "amaka", "ebuka",
  // Hausa
  "sani", "rana", "ruwa", "audu", "bello", "hauwa", "kano", "zaria", "gobe",
  // Greek
  "delphi", "kosmos", "zephyr", "lithos", "thalassa", "sophia", "helios",
  "selene", "kairos", "chronos", "gaia", "hermes", "athena", "apollo",
  "lyra", "orion", "kalos", "agape",
  // General
  "ember", "cobalt", "river", "cedar", "lumen", "vesper", "indigo", "onyx",
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
