let recognition;
let isRecognizing = false;
let selectedRow = 0;
let focusedColumn = "";
let currentDate = "";
let currentId = "";
let lastSnapshot = null;
let userId = null;
let userNm = "";
let corpNm = "";

window.addEventListener("beforeunload", function (e) {
    if (hasTableData()) {
        e.preventDefault();
        return '';
    }
});

document.getElementById("dialog-ok").addEventListener("click", () => {
    doOkStartModal();
});

document.getElementById("dialog-cancel").addEventListener("click", () => {
    doCancelStartModal();
});

document.addEventListener("DOMContentLoaded", () => {
    // 初期テーブルの25行生成
    createInitialRows(25);

    // 10秒ごとに差分をチェックし、更新がある場合はAPIによる更新を行う。
    lastSnapshot = JSON.stringify(getTableSnapshot());
    setInterval(() => {
        const currentSnapshot = JSON.stringify(getTableSnapshot());
        if (currentSnapshot !== lastSnapshot) {
            lastSnapshot = currentSnapshot;
            sendUpdateData();
        }
    }, 10000);

    // Cognitoユーザー情報取得
    getUserInfo();

    // DOMが生成された時点で開始モーダルを表示する。
    openStartModal();
});

const columnMap = {
    "重さ": 1,
    "回数": 2,
    "開始": 3,
    "終了": 4,
    "温度": 5
};

const columnPhysicalMap = {
    "index": 0,
    "weight": 1,
    "times": 2,
    "start_time": 3,
    "end_time": 4,
    "temp": 5
};

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('このブラウザはSpeechRecognition APIに対応していません。');
        return null;
    }

    const recognizer = new SpeechRecognition();
    recognizer.lang = 'ja-JP';
    recognizer.continuous = true;
    recognizer.interimResults = true;

    recognizer.onresult = function (event) {
        let finalTranscript = ''; // 確定した(黒の)認識結果
        let interimTranscript = ''; // 暫定(灰色)の認識結果
        for (let i = event.resultIndex; i < event.results.length; i++) {
            let transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript = transcript;
            } else {
                interimTranscript = transcript;
            }
        }
        document.querySelector('#speech-output').innerHTML = finalTranscript + '<i style="color:#ddd;">' + interimTranscript + '</i>';

        // 音声認識中の場合は以降の処理を実施しない
        if (!event.results[event.results.length - 1].isFinal) {
            return;
        }

        // 数値正規化
        finalTranscript = normalizeTextWithNumbers(finalTranscript);

        // 行選択：「○行目」
        const rowMatch = finalTranscript.match(/(\d+)行目/);
        if (rowMatch) {
            const rowNum = parseInt(rowMatch[1], 10);
            if (rowNum >= 1 && rowNum <= document.querySelectorAll("#data-table tbody tr").length) {
                selectedRow = rowNum - 1;
                focusedColumn = "";
                updateHighlights();
                scrollToSelectedRow();
                console.log(`選択された行: ${selectedRow + 1}`);
            }
            return;
        }

        // カラム選択：「重さ」「回数」など
        for (const colName in columnMap) {
            if (finalTranscript.includes(colName)) {
                focusedColumn = colName;
                updateHighlights();
                console.log(`フォーカス中のカラム: ${focusedColumn}`);
            }
        }

        // 時刻認識（「8時20分」など）
        if (focusedColumn === "開始" || focusedColumn === "終了") {
            let timeMatch = finalTranscript.match(/(\d{1,2})時(\d{1,2})分?/);

            if (!timeMatch && finalTranscript.includes("現在時刻")) {
                const now = new Date();
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                timeMatch = [null, hours, minutes];
            }

            if (timeMatch) {
                let hour = timeMatch[1].padStart(2, '0');
                let minute = timeMatch[2].padStart(2, '0');

                // Date オブジェクトを使って補正
                const baseDate = new Date(0);
                baseDate.setHours(hour);
                baseDate.setMinutes(minute);
                hour = String(baseDate.getHours()).padStart(2, '0');
                minute = String(baseDate.getMinutes()).padStart(2, '0');

                const timeStr = `${hour}:${minute}`;
                const row = document.querySelectorAll("#data-table tbody tr")[selectedRow];
                if (row) {
                    const cellIndex = columnMap[focusedColumn];
                    row.cells[cellIndex].textContent = timeStr;
                    console.log(`行${selectedRow + 1}の「${focusedColumn}」に ${timeStr} を入力`);

                    // 「開始」時刻のとき → 自動で「終了」に10分後を設定
                    if (focusedColumn === "開始") {
                        const endDate = new Date(0, 0, 0, parseInt(hour), parseInt(minute) + 10);
                        const endHour = String(endDate.getHours()).padStart(2, '0');
                        const endMinute = String(endDate.getMinutes()).padStart(2, '0');
                        const endStr = `${endHour}:${endMinute}`;

                        const endCellIndex = columnMap["終了"];
                        row.cells[endCellIndex].textContent = endStr;
                        console.log(`行${selectedRow + 1}の「終了」に ${endStr} を自動入力`);
                    }
                }
                focusedColumn = "";
                updateHighlights();
                return;
            }

        }

        // 数値認識（最後の数値を適用）
        if (focusedColumn === "重さ" || focusedColumn === "回数" || focusedColumn === "温度") {
            const numberMatch = finalTranscript.match(/(\d+(\.\d+)?)/g);
            if (numberMatch) {
                const value = numberMatch[numberMatch.length - 1];
                const row = document.querySelectorAll("#data-table tbody tr")[selectedRow];
                if (row) {
                    const cellIndex = columnMap[focusedColumn];
                    row.cells[cellIndex].textContent = value;
                    console.log(`行${selectedRow + 1}の「${focusedColumn}」に ${value} を入力`);
                    focusedColumn = "";
                    updateHighlights();
                }
                return;
            }
        }
    };

    recognizer.onerror = function (event) {
        console.error('SpeechRecognition Error:', event.error);
    };

    recognizer.onend = function () {
        if (isRecognizing) {
            recognizer.start(); // 自動再開
        }
        document.getElementById('speech-output').textContent = ""
    };

    return recognizer;
}

function startRecognition() {
    if (!recognition) {
        recognition = initSpeechRecognition();
    }
    if (recognition && !isRecognizing) {
        recognition.start();
        disabledStartButton();
        updateHighlights();
        isRecognizing = true;
        console.log('音声認識を開始しました');
    }
}

function stopRecognition() {
    if (recognition && isRecognizing) {
        recognition.stop();
        enabledStartButton();
        updateHighlights(true);
        isRecognizing = false;

        // 1行も入力せず終了した際にダウンロードボタンを非活性にする
        updateDownloadButtonState();

        console.log('音声認識を停止しました');
    }
}

function createInitialRows(count) {
    const tbody = document.querySelector("#data-table tbody");
    for (let i = 0; i < count; i++) {
        const row = document.createElement("tr");
        const indexCell = document.createElement("td");
        indexCell.textContent = `${i + 1}`;
        row.appendChild(indexCell);

        for (let j = 1; j <= 5; j++) {
            const cell = document.createElement("td");
            cell.textContent = "";
            if (columnMap['開始'] !== j && columnMap['終了'] !== j) {
                makeCellEditable(cell, cell_typ = 'number');
            } else {
                makeCellEditable(cell, cell_typ = 'time');
            }
            row.appendChild(cell);
        }

        tbody.appendChild(row);
    }
}

function makeCellEditable(cell, cell_typ = 'number') {
    cell.contentEditable = true;

    // Enterを押された場合に改行を防止し、編集確定とする
    cell.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            cell.blur();
        }
    });

    // 編集終了時にバリデーション
    if (cell_typ === 'number') {
        cell.addEventListener("blur", function () {
            const value = cell.innerText.trim();

            // 半角数値（小数もOK）にマッチするか確認
            if (!/^\d+(\.\d+)?$/.test(value)) {
                cell.innerText = "";
            }
        });
    } else if (cell_typ === 'time') {
        cell.addEventListener("blur", function () {
            const value = cell.innerText.trim();
            // 時刻にマッチするか確認
            if (!/^\d{2}:\d{2}$/.test(value)) {
                cell.innerText = "";
            }
        });
    }
}

function downloadCSV() {
    const table = document.getElementById("data-table");
    let csv = "date,id,index,weight,times,start_time,end_time,temp\n"; // ヘッダー行

    const tbodyRows = table.tBodies[0].rows;

    for (let row of tbodyRows) {
        const index = row.cells[0].textContent.trim();
        const weight = row.cells[1].textContent.trim();
        const times = row.cells[2].textContent.trim();
        const start_time = row.cells[3].textContent.trim() ? `"${row.cells[3].textContent.trim()}"` : '';
        const end_time = row.cells[4].textContent.trim() ? `"${row.cells[4].textContent.trim()}"` : '';
        const temp = row.cells[5].textContent.trim();
        csv += `${currentDate},${currentId},${index},${weight},${times},${start_time},${end_time},${temp}\n`;
    }

    // ▼ 日付＆時刻付きファイル名の生成
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${y}-${m}-${d}_${hh}${mm}${ss}`;
    const filename = `data_${timestamp}.csv`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function enabledStartButton() {
    document.getElementById("start-btn").disabled = false;
    document.getElementById("end-btn").disabled = true;
}

function disabledStartButton() {
    document.getElementById("start-btn").disabled = true;
    document.getElementById("end-btn").disabled = false;
}

function updateDownloadButtonState() {
    // ダウンロードボタンの制御関数
    const table = document.getElementById("data-table");
    const downloadBtn = document.getElementById("download-btn");
    const dataRowCount = table.getElementsByTagName("tbody")[0].rows.length;
    downloadBtn.disabled = dataRowCount === 0;
}

function updateHighlights(isClear = false) {
    const rows = document.querySelectorAll("#data-table tbody tr");
    const colIndex = !focusedColumn ? -1 : columnMap[focusedColumn];

    rows.forEach((row, i) => {
        // 行のハイライト
        if (!isClear && i === selectedRow) {
            row.classList.add("selected-row");
        } else {
            row.classList.remove("selected-row");
        }

        // 各セルのカラムハイライト
        for (let j = 1; j <= 5; j++) {
            const cell = row.cells[j];
            if (!isClear && j === colIndex && i === selectedRow) {
                cell.classList.add("selected-col");
                cell.classList.add("selected-cell");
            } else {
                cell.classList.remove("selected-col");
                cell.classList.remove("selected-cell");
            }
        }
    });
}

function openStartModal() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateInput = document.getElementById('dialog-date');
    const idInput = document.getElementById('dialog-id');
    dateInput.value = `${year}-${month}-${day}`;
    idInput.value = '';

    document.getElementById("start-modal").classList.remove("hidden");
    document.getElementById('overlay').classList.remove('hidden');
}

async function doOkStartModal() {
    const dateInput = document.getElementById('dialog-date');
    const idInput = document.getElementById('dialog-id');
    const dialogOkBtn = document.getElementById('dialog-ok');
    const dialogCancelBtn = document.getElementById('dialog-cancel');
    const idError = document.getElementById("id-error");

    const date = dateInput.value;
    const id = idInput.value.trim();

    // エラー初期化
    idError.textContent = "";

    // 入力値バリデーション
    if (!date) {
        idError.textContent = "日付を入力してください。";
        return;
    } else if (!id) {
        idError.textContent = "IDを入力してください。";
        return;
    } else if (!/^[a-zA-Z0-9]{1,20}$/.test(id)) {
        idError.textContent = "IDには半角英数字で20文字以内で入力してください。";
        return;
    }

    // ダイアログのボタンを無効化
    dialogOkBtn.disabled = true;
    dialogCancelBtn.disabled = true;

    // APIへPOST
    try {
        const API_BASE = `${location.origin}/api`;

        const payload = {
            user_id: userId,
            date,
            id
        };

        const res = await fetch(`${API_BASE}/request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
            alert("APIのリクエストに失敗しました。。\r\nシステム管理者に連絡してください。");
        }

        const json = await JSON.parse(await res.text());
        if (Array.isArray(json.body.table_data)) {
            populateTable(json.body.table_data);
            currentDate = date;
            currentId = id;
            userNm = json.body.user_nm;
            corpNm = json.body.corp_nm;
            document.getElementById("start-modal").classList.add("hidden");
            document.getElementById('overlay').classList.add('hidden');
            updateInfoDisplay(date, id, userNm, corpNm);
            startRecognition();
        } else {
            alert("無効なレスポンスです。\r\nシステム管理者に連絡してください。");
        }
    } catch (err) {
        alert("データ取得に失敗しました。\r\nシステム管理者に連絡してください。\r\n" + err.message);
    } finally {
        // ダイアログのボタンを再度有効化
        dialogOkBtn.disabled = false;
        dialogCancelBtn.disabled = false;
    }
}

function doCancelStartModal() {
    document.getElementById("start-modal").classList.add("hidden");
    document.getElementById('overlay').classList.add('hidden');
}

function populateTable(data) {
    const rows = document.querySelectorAll("#data-table tbody tr");

    // 表のデータをクリアする
    rows.forEach(row => {
        const cells = row.cells;
        for (const colName in columnMap) {
            const cellIndex = columnMap[colName];
            cells[cellIndex].textContent = '';
        }
    })

    // 受信したデータを表にセットする
    data.forEach(rec => {
        const cells = rows[rec['index'] - 1].cells;
        for (const colName in columnPhysicalMap) {
            const cellIndex = columnPhysicalMap[colName];
            let value = rec[colName];

            // ISO形式の時刻はHH:mmに変換
            if (typeof value === 'string' && value.match(/^18\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/)) {
                const dateObj = new Date(value);
                const hours = String(dateObj.getHours()).padStart(2, '0');
                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                value = `${hours}:${minutes}`;
            }

            cells[cellIndex].textContent = value ?? '';
        }
    });

    // スナップショットを更新する。
    lastSnapshot = JSON.stringify(getTableSnapshot());
}

function sendUpdateData() {
    if (!currentDate || !currentId) return;

    showSaveStatus("保存中...", "orange");

    const payload = {
        data_typ: "update",
        date: currentDate,
        id: currentId,
        data: getTableSnapshot()
    };

    const options = {
        method: 'POST',
        'Content-Type': "application/json",
        body: JSON.stringify(payload)
    };

    fetch(getUrlStr(), options)
        .then(res => {
            if (!res.ok) {
                alert("APIのリクエストに失敗しました。。\r\nシステム管理者に連絡してください。");
                return;
            }

            // 成功表示
            showSaveStatus("保存が完了しました。", "green");
        }).catch(err => {
            alert("データの更新に失敗しました。\r\nシステム管理者に連絡してください。");
        });
}

function getTableSnapshot() {
    const table = document.querySelector("#data-table tbody");
    const rows = table.querySelectorAll("tr");
    const data = [];

    rows.forEach((row, i) => {
        const cells = row.cells;
        if (cells.length < 6) return;

        const record = {
            index: i + 1,
            weight: parseFloat(cells[1].textContent) || null,
            times: parseFloat(cells[2].textContent) || null,
            start_time: cells[3].textContent || null,
            end_time: cells[4].textContent || null,
            temp: parseFloat(cells[5].textContent) || null
        };

        const allEmpty = Object.values(record).slice(1).every(v => !v);
        if (!allEmpty) {
            data.push(record);
        }
    });

    return data;
}

function showSaveStatus(message, color = 'green') {
    const statusDiv = document.getElementById('save-status');

    // すでに表示されていたら、フェードアウト → テキスト変更 → フェードイン
    if (statusDiv.style.opacity === '1') {
        statusDiv.style.opacity = '0';

        setTimeout(() => {
            statusDiv.textContent = message;
            statusDiv.style.color = color;
            statusDiv.style.opacity = '1';

            if (message !== "保存中...") {
                setTimeout(() => {
                    statusDiv.style.opacity = '0';
                }, 3000);
            }
        }, 500); // 0.5秒でフェードアウトしてから変更
    } else {
        // 初回表示など：そのままフェードイン
        statusDiv.textContent = message;
        statusDiv.style.color = color;
        statusDiv.style.opacity = '1';

        if (message !== "保存中...") {
            setTimeout(() => {
                statusDiv.textContent = "";
                statusDiv.style.opacity = '0';
            }, 3000); // 3秒後に非表示
        }
    }
}

function hasTableData() {
    const rows = document.querySelectorAll("#data-table tbody tr");
    for (const row of rows) {
        const cells = Array.from(row.cells).slice(1); // index列を除く
        for (const cell of cells) {
            if (cell.textContent.trim() !== "") {
                return true;
            }
        }
    }
    return false;
}

function scrollToSelectedRow() {
    if (typeof selectedRow === 'number') {
        const tableBody = document.querySelector('#data-table tbody');
        const row = tableBody?.rows[selectedRow];

        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }
}

function updateInfoDisplay(dateStr, idStr, userNmStr, corpNmStr) {
    const infoDiv = document.getElementById("info-display");
    infoDiv.textContent = ` 名前: ${userNmStr} / 企業: ${corpNmStr} / 日付: ${dateStr} / ID: ${idStr} `;
}

function normalizeTextWithNumbers(text) {
    // 全角→半角数字へ
    text = text.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

    // 漢数字の変換（百まで）
    const kanjiDigitMap = {
        "〇": 0, "零": 0, "一": 1, "二": 2, "三": 3, "四": 4,
        "五": 5, "六": 6, "七": 7, "八": 8, "九": 9
    };

    // マッチするパターン例：「百二十三」「五十」「三」
    const pattern = /[一二三四五六七八九]?[百]?[一二三四五六七八九]?[十]?[一二三四五六七八九]?/g;

    text = text.replace(pattern, (match) => {
        if (!match) return match;

        let num = 0;
        let temp = match;

        // 百
        if (temp.includes("百")) {
            const idx = temp.indexOf("百");
            const left = temp.slice(0, idx);
            num += (left ? kanjiDigitMap[left] : 1) * 100;
            temp = temp.slice(idx + 1);
        }

        // 十
        if (temp.includes("十")) {
            const idx = temp.indexOf("十");
            const left = temp.slice(0, idx);
            num += (left ? kanjiDigitMap[left] : 1) * 10;
            temp = temp.slice(idx + 1);
        }

        // 一の位
        if (temp.length === 1 && kanjiDigitMap[temp]) {
            num += kanjiDigitMap[temp];
        } else if (temp.length > 1) {
            return match; // 不正なパターンはそのまま
        }

        return num > 0 ? String(num) : match;
    });

    return text;
}

function getUrlStr() {
    const GAS_SERVER = "AKfycbzOBoZ7L-7NYbCIHvRWpM1FgHJEpp-qaLV_sP_1WzfMELLrKLUp_KtswIYnkxxg-wBK/exec";
    return `https://script.google.com/macros/s/${GAS_SERVER}/exec`
}

function getUserInfo() {
    const cookieName = "CognitoIdentityServiceProvider.5i7fv4lllu23b9o1ggqnvitqsd.LastAuthUser";
    const cookies = document.cookie.split(";");

    for (const cookie of cookies) {
        const [key, value] = cookie.trim().split("=");
        if (key === cookieName) {
            userId = decodeURIComponent(value);
            console.log("ログインユーザーID:", userId);
            return;
        }
    }

    console.log("ログイン情報が取得できませんでした。\r\nシステム管理者へお問い合わせください。");
}