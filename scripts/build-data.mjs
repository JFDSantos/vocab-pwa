import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ALLOWED_POS = new Set(['noun', 'verb', 'adj', 'adv', 'prep', 'pron', 'conj', 'det', 'intj', 'num', 'article', 'particle']);
const FORM_TAGS = new Set(['form-of', 'alt-of', 'misspelling']);
const BAD_TAGS = new Set([...FORM_TAGS, 'obsolete', 'archaic', 'dated', 'historical', 'rare', 'slang', 'vulgar', 'offensive', 'derogatory', 'euphemism', 'dialectal']);
const FORM_OF = /\b(form|spelling|tense|participle|plural|singular|comparative|superlative|inflection|variant|abbreviation|initialism|contraction) of\b|\bof the verb\b|^(the )?(act|action|process) of\b/i;
const MAX_GLOSS = 140;
const US_TAGS = new Set(['US', 'General-American']);

export function parseFreqList(text) {
  const seen = new Set();
  const out = [];
  for (const line of text.split('\n')) {
    const word = line.trim().split(/\s+/)[0]?.toLowerCase();
    if (!word || !/^[a-z]+$/.test(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  return out;
}

const BAD_LABEL = /^\([^)]*\b(slang|vulgar|offensive|derogatory|euphemism|dialectal|obsolete|archaic)\b[^)]*\)/i;

function isLabelledBad(sense) {
  return (sense.tags ?? []).some((t) => BAD_TAGS.has(t)) || (sense.raw_glosses ?? []).some((g) => BAD_LABEL.test(g));
}

function shortGloss(sense) {
  const glosses = (sense.glosses ?? []).filter((g) => g && g.length <= MAX_GLOSS && !FORM_OF.test(g));
  if (glosses.length === 0) return null;
  return glosses.reduce((a, b) => (b.length < a.length ? b : a));
}

function isInflected(sense) {
  return (sense.tags ?? []).some((t) => FORM_TAGS.has(t)) || (sense.glosses ?? []).some((g) => FORM_OF.test(g));
}

export function pickEntry(entries) {
  const candidates = (entries ?? []).filter((e) => e.lang_code === 'en' && ALLOWED_POS.has(e.pos));
  if (candidates.length === 0) return null;
  const first = candidates[0].senses?.[0];
  if (first && isInflected(first)) return null;
  const ordered = [...candidates].sort((a, b) => (b.senses?.length ?? 0) - (a.senses?.length ?? 0));
  for (const entry of ordered) {
    for (const sense of entry.senses ?? []) {
      if (isLabelledBad(sense)) continue;
      const definition = shortGloss(sense);
      if (!definition) break;
      const record = { word: entry.word.toLowerCase(), pos: entry.pos, definition };
      const ipa = (entry.sounds ?? []).find((s) => s.ipa && (s.tags ?? []).some((t) => US_TAGS.has(t)))?.ipa;
      if (ipa) record.ipa = ipa;
      const example = (sense.examples ?? []).find((e) => e.type === 'example' && e.text && e.text.length <= MAX_GLOSS)?.text;
      if (example) record.example = example;
      const pt = (entry.translations ?? []).find((t) => t.lang_code === 'pt' && t.word)?.word;
      if (pt) record.pt = pt;
      return record;
    }
  }
  return null;
}

export function applyExclude(freqList, excludeText) {
  const excluded = new Set(
    excludeText.split('\n').map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith('#')),
  );
  return freqList.filter((w) => !excluded.has(w));
}

export function buildWords(freqList, entries, target) {
  const byWord = new Map();
  for (const e of entries) {
    const key = e.word?.toLowerCase();
    if (!byWord.has(key)) byWord.set(key, []);
    byWord.get(key).push(e);
  }
  const out = [];
  for (const word of freqList) {
    if (out.length >= target) break;
    const r = pickEntry(byWord.get(word));
    if (!r) continue;
    const rank = out.length + 1;
    out.push({ id: r.word, rank, ...r });
  }
  return out;
}

function main([freqPath, entriesPath, outPath, target, excludePath]) {
  let freq = parseFreqList(readFileSync(freqPath, 'utf8'));
  if (excludePath) freq = applyExclude(freq, readFileSync(excludePath, 'utf8'));
  const entries = readFileSync(entriesPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const words = buildWords(freq, entries, Number(target));
  writeFileSync(outPath, JSON.stringify(words));
  console.log(`wrote ${words.length} words to ${outPath}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv.slice(2));
