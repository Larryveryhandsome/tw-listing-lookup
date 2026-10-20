/* tw-listing-lookup 畫面邏輯。查詢規則在 lookup.js。 */
(function () {
  'use strict';
  const L = window.Lookup;
  const CFG = window.LOOKUP_CONFIG || {};
  const SRC = CFG.source || { type: 'csv' };
  const KEY = 'tw-listing-lookup:csv';
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let records = [];
  let dataLabel = '';
  let ready = Promise.resolve(); // csvUrl 模式：資料讀完才能查（網址帶 ?id= 時尤其需要）

  function setStatus(msg, err) {
    $('status').textContent = msg;
    $('status').className = 'status' + (err ? ' err' : '');
  }

  // ---------- 資料來源 ----------
  function useCSV(text, label, remember) {
    const recs = L.loadCSV(text);
    if (recs.length && !(CFG.idField in recs[0])) {
      setStatus(`這個 CSV 沒有「${CFG.idField}」欄位，請檢查第一列的欄位名稱。`, true);
      return false;
    }
    records = recs;
    dataLabel = label;
    if (remember) {
      try { localStorage.setItem(KEY, JSON.stringify({ label, text })); } catch (e) { /* 檔案太大或無法存，就只用這一次 */ }
    }
    if ($('dataInfo')) $('dataInfo').textContent = `目前資料：${label}，共 ${records.length} 筆。`;
    setStatus(`已載入 ${records.length} 筆資料，可以開始查詢。`);
    return true;
  }

  function initCSV() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 沒存過 */ }
    if (saved && saved.text) useCSV(saved.text, saved.label, false);
    else if (window.SAMPLE_CSV) useCSV(window.SAMPLE_CSV, '示範資料（全部是假的）', false);

    $('file').addEventListener('change', e => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => { if (useCSV(r.result, f.name, true)) $('q').focus(); };
      r.onerror = () => setStatus('讀檔失敗，請再試一次。', true);
      r.readAsText(f, 'utf-8');
    });
    $('btnSample').addEventListener('click', () => {
      try { localStorage.removeItem(KEY); } catch (e) { /* 略過 */ }
      useCSV(window.SAMPLE_CSV || '', '示範資料（全部是假的）', false);
    });
    $('btnClear').addEventListener('click', () => {
      try { localStorage.removeItem(KEY); } catch (e) { /* 略過 */ }
      records = [];
      $('dataInfo').textContent = '這台電腦已經沒有存資料，請重新選擇 CSV 檔。';
      $('results').innerHTML = '';
      setStatus('已清除。');
    });
  }

  async function initCsvUrl() {
    $('dataCsv').innerHTML = '<p class="hint">資料來源：設定檔指定的 CSV 網址（每次打開網頁都重新讀取）。</p>';
    setStatus('讀取資料中…');
    try {
      const res = await fetch(SRC.csvUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      useCSV(await res.text(), 'CSV 網址', false);
    } catch (e) {
      setStatus('資料讀取失敗：' + e.message + '。請檢查 config.js 的 csvUrl。', true);
    }
  }

  // ---------- 顯示 ----------
  function card(rec) {
    const fields = CFG.showFields && CFG.showFields.length ? CFG.showFields.filter(f => f in rec) : Object.keys(rec);
    const hl = CFG.highlight || {};
    return '<div class="card"><dl>' + fields.map(f => {
      const v = rec[f];
      const color = hl[f] && hl[f][v];
      return `<dt>${esc(f)}</dt><dd>${color ? `<span class="tag ${esc(color)}">${esc(v)}</span>` : esc(v) || '—'}</dd>`;
    }).join('') + '</dl></div>';
  }
  function show(list, label) {
    $('results').innerHTML = list.map(card).join('');
    setStatus(list.length ? label : '找不到資料，請確認編號是否正確。', !list.length);
  }

  async function query(q) {
    q = q.trim();
    if (!q) { $('results').innerHTML = ''; setStatus(''); return; }
    await ready;
    if (SRC.type === 'api') {
      setStatus('查詢中…');
      try {
        const res = await fetch(L.buildApiUrl(SRC.api.url, q), { headers: { Accept: 'application/json' } });
        if (res.status === 404) return show([], '');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const list = L.mapApiResponse(await res.json(), SRC.api.fields, SRC.api.listPath);
        show(list, `編號 ${q}：找到 ${list.length} 筆`);
      } catch (e) {
        $('results').innerHTML = '';
        setStatus('資料取得失敗（' + e.message + '），請聯絡系統管理員。', true);
      }
      return;
    }
    if (!records.length && SRC.type === 'csvUrl') return; // 讀取失敗的訊息已顯示，不要蓋掉
    if (!records.length) { setStatus('還沒有資料，請先在下方「資料來源」選擇 CSV 檔。', true); $('dataBox').open = true; return; }
    const r = L.lookup(records, CFG.idField, q, { searchFields: CFG.searchFields });
    show(r.results, r.mode === 'id' ? `${CFG.idField} ${q}` : `關鍵字「${q}」：找到 ${r.results.length} 筆${r.results.length >= 50 ? '（只顯示前 50 筆）' : ''}`);
  }

  // ---------- 啟動 ----------
  document.title = CFG.title || '編號查詢';
  $('title').textContent = CFG.title || '編號查詢';
  $('idFieldName').textContent = CFG.idField;
  if (SRC.type === 'api') {
    $('qLabel').textContent = `輸入${CFG.idField}`;
    $('dataBox').hidden = true;
  } else {
    $('qLabel').textContent = `輸入${CFG.idField}，或關鍵字（案名、地址、承辦人…）`;
    if (SRC.type === 'csvUrl') ready = initCsvUrl(); else initCSV();
  }
  $('form').addEventListener('submit', e => { e.preventDefault(); query($('q').value); });

  // 網址帶 ?id=12 會直接查（方便做成書籤或 QR code）
  const pre = new URLSearchParams(location.search).get('id');
  if (pre) { $('q').value = pre; setTimeout(() => query(pre), 0); }
})();
