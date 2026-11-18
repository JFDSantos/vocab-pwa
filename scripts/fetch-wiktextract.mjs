// Usage: node scripts/fetch-wiktextract.mjs <freq.txt> <out.jsonl> <count>
// Downloads per-word Wiktextract JSONL from kaikki.org (cached in .cache/wiktextract/).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { parseFreqList } from './build-data.mjs';

const [freqPath, outPath, count] = process.argv.slice(2);
const words = parseFreqList(readFileSync(freqPath, 'utf8')).filter((w) => w.length >= 2).slice(0, Number(count));
const dir = '.cache/wiktextract';
mkdirSync(dir, { recursive: true });

async function fetchWord(word) {
  const file = `${dir}/${word}.jsonl`;
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const url = `https://kaikki.org/dictionary/English/meaning/${word[0]}/${word.slice(0, 2)}/${word}.jsonl`;
  const res = await fetch(url);
  const text = res.ok ? await res.text() : '';
  writeFileSync(file, text);
  return text;
}

const results = new Array(words.length);
let next = 0;
async function worker() {
  while (next < words.length) {
    const i = next++;
    try { results[i] = await fetchWord(words[i]); } catch { results[i] = ''; }
    if (i % 200 === 0) console.log(`${i}/${words.length}`);
  }
}
await Promise.all(Array.from({ length: 5 }, worker));
writeFileSync(outPath, results.join('\n'));
console.log('done');
