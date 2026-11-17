import test from 'node:test';
import assert from 'node:assert/strict';
import { canSpeak, speak } from '../src/speech.js';

function stubSpeech() {
  const calls = { spoken: [], cancelled: 0 };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  globalThis.speechSynthesis = { speak: (u) => calls.spoken.push(u), cancel: () => calls.cancelled++ };
  return calls;
}
function clearSpeech() {
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
}

test('canSpeak false when speechSynthesis undefined', () => {
  clearSpeech();
  assert.equal(canSpeak(), false);
  assert.doesNotThrow(() => speak('run'));
});

test('speak sets lang en-US and the text', () => {
  const calls = stubSpeech();
  try {
    assert.equal(canSpeak(), true);
    speak('run');
    assert.equal(calls.spoken.length, 1);
    assert.equal(calls.spoken[0].text, 'run');
    assert.equal(calls.spoken[0].lang, 'en-US');
  } finally {
    clearSpeech();
  }
});
