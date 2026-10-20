// 執行：npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('../js/lookup.js');

const root = path.join(__dirname, '..');
const csv = fs.readFileSync(path.join(root, 'data', 'listings.example.csv'), 'utf8');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), ctx);
vm.runInNewContext(fs.readFileSync(path.join(root, 'data', 'sample.js'), 'utf8'), ctx);
const CFG = ctx.window.LOOKUP_CONFIG;
const recs = L.loadCSV(csv);

test('CSV 解析：BOM、引號、跳脫的雙引號、CRLF', () => {
  const rows = L.parseCSV('\ufeffa,b\r\n1,"x,y"\r\n2,"他說""好"""\r\n3,"兩\n行"\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['1', 'x,y'], ['2', '他說"好"'], ['3', '兩\n行']]);
  assert.deepEqual(L.parseCSV('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(L.parseCSV('a\n\n1\n'), [['a'], ['1']]);
});

test('範本 CSV 和網頁內建示範資料一模一樣', () => {
  assert.equal(ctx.window.SAMPLE_CSV.replace(/^\ufeff/, ''), csv.replace(/^\ufeff/, ''));
});

test('範本 CSV 的欄位和設定檔對得上', () => {
  assert.ok(recs.length >= 10);
  assert.ok(CFG.idField in recs[0]);
  for (const f of CFG.showFields) assert.ok(f in recs[0], f);
  for (const f of CFG.searchFields) assert.ok(f in recs[0], f);
});

test('編號正規化：全形、空白、前導 0', () => {
  assert.equal(L.normalizeId('０１２'), '12');
  assert.equal(L.normalizeId(' 0 7 '), '7');
  assert.equal(L.normalizeId('a-01'), 'A-01');
  assert.equal(L.normalizeId('0'), '0');
});

test('用編號查：完全相同才算', () => {
  const r = L.lookup(recs, CFG.idField, '３', { searchFields: CFG.searchFields });
  assert.equal(r.mode, 'id');
  assert.equal(r.results.length, 1);
  assert.equal(r.results[0][CFG.idField], '3');
});

test('用關鍵字查：多個關鍵字都要符合', () => {
  const r = L.lookup(recs, CFG.idField, '透天 業務A', { searchFields: CFG.searchFields });
  assert.equal(r.mode, 'keyword');
  assert.ok(r.results.length >= 1);
  for (const x of r.results) { assert.equal(x['類型'], '透天'); assert.equal(x['承辦人'], '業務A'); }
  assert.equal(L.lookup(recs, CFG.idField, '不存在的字', {}).results.length, 0);
  assert.equal(L.lookup(recs, CFG.idField, '   ', {}).results.length, 0);
});

test('API 網址：{id} 會被換掉並編碼', () => {
  assert.equal(L.buildApiUrl('https://example.com/api?id={id}', ' ０１2 '), 'https://example.com/api?id=12');
  assert.equal(L.buildApiUrl('https://example.com/x/{id}', 'a&b'), 'https://example.com/x/A%26B');
  assert.throws(() => L.buildApiUrl('https://example.com/api', '1'));
});

test('API 回應轉換：物件、陣列、{data:[]}、巢狀欄位、空結果', () => {
  const map = { 地址: 'address', 承辦人: 'agent.name' };
  assert.deepEqual(L.mapApiResponse({ address: '示範路1號', agent: { name: '業務A' } }, map), [{ 地址: '示範路1號', 承辦人: '業務A' }]);
  assert.deepEqual(L.mapApiResponse({ data: [{ address: 'x' }] }, map), [{ 地址: 'x', 承辦人: '' }]);
  assert.deepEqual(L.mapApiResponse({ result: [{ address: 'y' }] }, map, 'result'), [{ 地址: 'y', 承辦人: '' }]);
  assert.deepEqual(L.mapApiResponse([], map), []);
  assert.deepEqual(L.mapApiResponse({}, map), []);
  assert.deepEqual(L.mapApiResponse({ a: 1, b: null }), [{ a: '1', b: '' }]);
});
