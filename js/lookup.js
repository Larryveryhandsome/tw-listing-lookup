/*
 * tw-listing-lookup 查詢核心（純函式，不碰畫面）
 * 瀏覽器：window.Lookup；Node：require('./lookup.js')
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Lookup = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** 解析 CSV：支援 BOM、雙引號、欄位內換行、CRLF。回傳二維陣列。 */
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(v => v.trim() !== ''));
  }

  /** CSV 第一列當欄位名稱，轉成物件陣列 */
  function toRecords(rows) {
    if (!rows.length) return [];
    const head = rows[0].map(h => h.trim());
    return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
  }

  function loadCSV(text) {
    return toRecords(parseCSV(text));
  }

  /** 編號正規化：全形轉半形、去空白、去開頭的 0（「007」和「7」視為同一號） */
  function normalizeId(v) {
    let s = String(v == null ? '' : v)
      .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/\s+/g, '')
      .toUpperCase();
    if (/^\d+$/.test(s)) s = s.replace(/^0+(?=\d)/, '');
    return s;
  }

  /** 用編號找（完全相同） */
  function findById(records, idField, query) {
    const q = normalizeId(query);
    if (!q) return [];
    return records.filter(r => normalizeId(r[idField]) === q);
  }

  /** 關鍵字找：每個字都要出現在某個欄位（空白分開多個關鍵字） */
  function search(records, keyword, fields) {
    const words = String(keyword || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return records.filter(r => {
      const hay = (fields && fields.length ? fields.map(f => r[f]) : Object.values(r)).join('\u0001').toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }

  /** 先用編號找；找不到再用關鍵字找 */
  function lookup(records, idField, query, opts) {
    const exact = findById(records, idField, query);
    if (exact.length) return { mode: 'id', results: exact };
    const limit = (opts && opts.limit) || 50;
    return { mode: 'keyword', results: search(records, query, opts && opts.searchFields).slice(0, limit) };
  }

  /**
   * 找出「看起來是個資」的欄位名稱（屋主姓名、客戶電話、身分證…）。
   * 承辦人／業務／店長／公司這類「對外聯絡用」的電話不算。
   * 用在「CSV 網址模式」：發布到網路的 CSV 任何人都下載得到，欄位多半不該公開。
   */
  const PII_ALWAYS = /屋主|所有權人|所有人|賣方|買方|委託人|客戶|業主|房東|房客|租客|姓名|身分證|身份證|生日|出生|戶籍|統編|統一編號|e-?mail|信箱|私人|個資|owner|customer|client|idcard|birth/i;
  const PII_PHONE = /電話|手機|行動|聯絡|phone|mobile|tel/i;
  const PUBLIC_CONTACT = /承辦|業務|經紀|店長|門市|公司|店|分店|專員|agent|office|store/i;
  function sensitiveHeaders(headers) {
    return (headers || []).map(h => String(h || '').trim()).filter(h => {
      if (!h) return false;
      if (PII_ALWAYS.test(h)) return true;
      return PII_PHONE.test(h) && !PUBLIC_CONTACT.test(h);
    });
  }

  /** API 網址：把 {id} 換成編號（會自動編碼） */
  function buildApiUrl(template, id) {
    if (!/\{id\}/.test(template || '')) throw new Error('API 網址裡要有 {id}');
    return template.replace(/\{id\}/g, encodeURIComponent(normalizeId(id)));
  }

  /** 讀 API 回應中的某個欄位，支援 a.b.c 這種巢狀寫法 */
  function pick(obj, path) {
    return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  /**
   * API 回應轉成要顯示的資料。
   * fieldMap：{ 顯示名稱: 'API 欄位' }，沒給就全部顯示。
   * 回應可以是物件、陣列，或 {data: …}。空物件／空陣列視為找不到。
   */
  function mapApiResponse(data, fieldMap, listPath) {
    let list = listPath ? pick(data, listPath) : data;
    if (list && !Array.isArray(list) && typeof list === 'object' && Array.isArray(list.data)) list = list.data;
    if (!Array.isArray(list)) list = list && typeof list === 'object' && Object.keys(list).length ? [list] : [];
    return list.filter(x => x && typeof x === 'object').map(item => {
      if (!fieldMap || !Object.keys(fieldMap).length) return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, v == null ? '' : String(v)]));
      return Object.fromEntries(Object.entries(fieldMap).map(([label, key]) => {
        const v = pick(item, key);
        return [label, v == null ? '' : String(v)];
      }));
    });
  }

  return { parseCSV, toRecords, loadCSV, sensitiveHeaders, normalizeId, findById, search, lookup, buildApiUrl, pick, mapApiResponse };
});
