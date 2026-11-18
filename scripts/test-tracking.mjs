import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const thanks = readFileSync('thanks.html', 'utf8');
const scripts = [...thanks.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((match) => match[1].trim()).filter(Boolean);
const completionScript = scripts.find((script) => script.includes("track('generate_lead'"));
assert.ok(completionScript, 'Completion tracking script not found');

function executeThanks({ completed }) {
  const events = [];
  const store = new Map(completed ? [['ex_takumi_form_completed', '1']] : []);
  let loadHandler;
  const context = {
    location: { search: '' },
    URLSearchParams,
    sessionStorage: {
      getItem: (key) => store.get(key) ?? null,
      removeItem: (key) => store.delete(key),
    },
    window: {
      addEventListener: (name, handler) => { if (name === 'load') loadHandler = handler; },
      exTakumiAnalytics: {
        track: (name, params) => events.push({ channel: 'ga4', name, params }),
        trackMeta: (name, params) => events.push({ channel: 'meta', name, params }),
      },
    },
  };
  vm.runInNewContext(completionScript, context);
  assert.equal(typeof loadHandler, 'function');
  loadHandler();
  return { events, store };
}

const unsuccessful = executeThanks({ completed: false });
assert.equal(unsuccessful.events.filter((event) => event.name === 'generate_lead').length, 0);

const successful = executeThanks({ completed: true });
assert.equal(successful.events.filter((event) => event.name === 'generate_lead').length, 1);
assert.equal(successful.store.has('ex_takumi_form_completed'), false);

const reload = executeThanks({ completed: successful.store.has('ex_takumi_form_completed') });
assert.equal(reload.events.filter((event) => event.name === 'generate_lead').length, 0);

console.log('Tracking behavior tests passed.');
