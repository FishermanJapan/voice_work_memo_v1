// ヘッダの構成
const headers = ["date", "id", "index", "weight", "times", "start_time", "end_time", "temp"];

function doPost(e) {
  let request_data;
  try {
    request_data = JSON.parse(e.postData.contents);
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.message).setMimeType(ContentService.MimeType.TEXT);
  }

  if (request_data.data_typ === "request") {
    const res = request(request_data);
    return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
  } else if (request_data.data_typ === "update") {
    update(request_data);
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  } else {
    return ContentService.createTextOutput("Invalid data_typ").setMimeType(ContentService.MimeType.TEXT);
  }

}

function request(req) {
  const dateStr = req.date; // e.g., "2025-05-22"
  const sheetName = dateStr.slice(0, 4) + dateStr.slice(5, 7); // e.g., "202505"
  const id = "id" + req.id;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  // シートがなければ作成してヘッダー追加
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const dataRows = sheet.getDataRange().getValues(); // 全行取得
  const timeZone = SpreadsheetApp.getActive().getSpreadsheetTimeZone();

  const matchedData = dataRows
    .filter(r => {
      const rowDateStr = (Object.prototype.toString.call(r[0]) === '[object Date]')
        ? Utilities.formatDate(r[0], timeZone, 'yyyy-MM-dd')
        : r[0];
      return rowDateStr === dateStr && r[1] === id;
    })
    .map(r => ({
      index: r[2],
      weight: r[3],
      times: r[4],
      start_time: r[5],
      end_time: r[6],
      temp: r[7]
    }));

  return { date: dateStr, id: req.id, data: matchedData };
}

function update(req) {
  const dateStr = req.date; // e.g., "2025-05-22"
  const sheetName = dateStr.slice(0, 4) + dateStr.slice(5, 7); // e.g., "202505"
  const id = "id" + req.id;
  const dataList = req.data;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);

  // シートがなければ作成してヘッダー追加
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const dataRows = sheet.getDataRange().getValues(); // 全行取得
  const timeZone = SpreadsheetApp.getActive().getSpreadsheetTimeZone();

  dataList.forEach(entry => {
    const row = [
      dateStr,
      id,
      entry.index,
      entry.weight,
      entry.times,
      entry.start_time,
      entry.end_time,
      entry.temp
    ];

    // 一致行を探す
    const existingRowIndex = dataRows.findIndex(r => {
      const rowDateStr = (Object.prototype.toString.call(r[0]) === '[object Date]')
        ? Utilities.formatDate(r[0], timeZone, 'yyyy-MM-dd')
        : r[0]; // 既に文字列の場合はそのまま
      return rowDateStr === dateStr && r[1] === id && String(r[2]) === String(entry.index);
    }
    );

    if (existingRowIndex !== -1) {
      // 上書き
      sheet.getRange(existingRowIndex + 1, 1, 1, row.length).setValues([row]);
    } else {
      // 新規追加
      sheet.appendRow(row);
    }
  });
}

function request_test() {
  const req = {
    "data_typ": "request",
    "date": "2025-05-29",
    "id": "00123"
  }

  console.log(request(req));
}

function update_test() {
  const req = {
    "data_typ": "update",
    "date": "2025-05-29",
    "id": "00123",
    "data": [
      {
        "index": 1,
        "weight": 12,
        "times": 23,
        "start_time": "05:10",
        "end_time": "05:20",
        "temp": 25
      }
    ]
  }

  update(req);
}
