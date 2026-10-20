// app.js 的載入／查詢順序回歸測試：用最簡單的假 DOM + 假 fetch，不需要瀏覽器。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('../js/lookup.js');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const csv = read('data/listings.example.csv');

function boot({ search, fetchImpl, type = 'csvUrl' }) {
  const els = {};
  const el = id => (els[id] = els[id] || { id, textContent: '', innerHTML: '', value: '', className: '', hidden: false, open: false,
    listeners: {}, addEventListener(n, f) { this.listeners[n] = f; }, focus() {} });
  const win = { Lookup: L };
  ['q', 'form'].forEach(el);
  const ctx = {
    window: win, Lookup: L, URLSearchParams, setTimeout, console, Promise,
    document: { getElementById: el, title: '' },
    location: { search },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: fetchImpl,
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('config.js'), ctx);
  win.LOOKUP_CONFIG.source = type === 'csvUrl' ? { type: 'csvUrl', csvUrl: 'http://x/list.csv' } : { type: 'csv' };
  vm.runInContext(read('data/sample.js'), ctx);
  vm.runInContext(read('js/app.js'), ctx);
  return els;
}
const delay = ms => new Promise(r => setTimeout(r, ms));

test('csvUrl 模式：網址帶 ?id= 時，要等 CSV 載完再查（不能空白）', async () => {
  const els = boot({ search: '?id=3', fetchImpl: async () => { await delay(60); return { ok: true, text: async () => csv }; } });
  await delay(250);
  assert.match(els.results.innerHTML, /示範透天甲/);
  assert.match(els.status.textContent, /售版編號 3/);
});

test('csvUrl 模式：手動送出查詢也會等資料載完', async () => {
  const els = boot({ search: '', fetchImpl: async () => { await delay(60); return { ok: true, text: async () => csv }; } });
  els.q.value = '12';
  els.form.listeners.submit({ preventDefault() {} });
  await delay(250);
  assert.match(els.results.innerHTML, /示範電梯大樓乙/);
});

test('csvUrl 模式：讀取失敗時保留失敗訊息，不誤導成「請選 CSV 檔」', async () => {
  const els = boot({ search: '?id=3', fetchImpl: async () => ({ ok: false, status: 500, text: async () => '' }) });
  await delay(150);
  assert.match(els.status.textContent, /資料讀取失敗/);
  assert.doesNotMatch(els.status.textContent, /選擇 CSV 檔/);
});

test('csv 模式：?id= 直接用內建示範資料查', async () => {
  const els = boot({ type: 'csv', search: '?id=3', fetchImpl: async () => { throw new Error('不該呼叫 fetch'); } });
  await delay(50);
  assert.match(els.results.innerHTML, /示範透天甲/);
});
