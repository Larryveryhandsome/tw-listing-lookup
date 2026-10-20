/*
 * tw-listing-lookup 設定檔
 * 用記事本打開就能改，改完存檔、重新整理網頁即可。
 */
window.LOOKUP_CONFIG = {
  title: '示範不動產 售版編號查詢',

  // 編號欄位叫什麼（要和 CSV 第一列的欄位名稱一模一樣）
  idField: '售版編號',

  // 查到之後要顯示哪些欄位、照什麼順序（留空陣列 [] 就全部顯示）
  showFields: ['售版編號', '案名', '地址', '類型', '總價(萬)', '承辦人', '承辦人電話', '狀態', '備註'],

  // 用關鍵字找時，在哪些欄位裡找（留空陣列 [] 就全部欄位都找）
  searchFields: ['案名', '地址', '承辦人', '類型', '狀態', '備註'],

  // 某些欄位值要特別標顏色
  highlight: {
    狀態: { 已成交: 'gray', 已下架: 'gray', 斡旋中: 'orange', 銷售中: 'green' },
  },

  /*
   * 資料來源，三選一：
   *
   * 1) 'csv'：在網頁上選一個 CSV 檔（Excel 另存新檔 → CSV UTF-8）。
   *    資料只存在這台電腦的瀏覽器，不會上傳。
   *
   * 2) 'csvUrl'：從網址讀 CSV，例如 Google 試算表「發布到網路 → CSV」的網址。
   *    注意：發布到網路等於任何知道網址的人都看得到，原則上不要放個資。
   *
   * 3) 'api'：自己的後端 API。網址裡的 {id} 會換成使用者輸入的編號。
   *    fields：{ 顯示名稱: 'API 回傳的欄位' }，支援 a.b 這種巢狀寫法。
   */
  source: {
    type: 'csv',
    csvUrl: '',
    api: {
      url: 'https://example.com/api/listing?id={id}',
      fields: { 地址: 'address', 承辦人: 'agent' },
      listPath: '', // 回傳是 { result: [...] } 這種格式時填 'result'
    },
  },
};
