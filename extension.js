const vscode = require("vscode");
const path = require("path");

const STATE_KEY = "seatingArrangement.layout";

let panel = null;

/** 쉼표 / 줄바꿈 / 탭으로 구분된 이름 목록을 파싱합니다. */
function parseStudents(text) {
  return text
    .split(/[,\r\n\t]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/** 설정 → 워크스페이스 파일 → 번들 샘플 순서로 학생 목록을 읽습니다. */
async function loadStudents(context) {
  const config = vscode.workspace.getConfiguration("seatingArrangement");

  const fromSettings = config.get("students", []);
  if (Array.isArray(fromSettings) && fromSettings.length > 0) {
    return { students: fromSettings, source: "settings.json" };
  }

  const relativePath = config.get("studentListFile", "학생.txt");
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const fileUri = vscode.Uri.joinPath(folder.uri, relativePath);
    try {
      const bytes = await vscode.workspace.fs.readFile(fileUri);
      const students = parseStudents(Buffer.from(bytes).toString("utf8"));
      if (students.length > 0) {
        return { students, source: path.join(folder.name, relativePath) };
      }
    } catch {
      // 다음 워크스페이스 폴더에서 계속 찾습니다.
    }
  }

  const sampleUri = vscode.Uri.joinPath(context.extensionUri, "students.sample.txt");
  try {
    const bytes = await vscode.workspace.fs.readFile(sampleUri);
    return { students: parseStudents(Buffer.from(bytes).toString("utf8")), source: "샘플 목록" };
  } catch {
    return { students: [], source: "없음" };
  }
}

/** 학생 목록을 사용자 설정에 쓰면 Settings Sync로 다른 환경에도 전파됩니다. */
async function saveStudents(list) {
  const cleaned = (list ?? []).map((name) => String(name).trim()).filter(Boolean);
  await vscode.workspace
    .getConfiguration("seatingArrangement")
    .update("students", cleaned, vscode.ConfigurationTarget.Global);
  vscode.window.showInformationMessage(`학생 ${cleaned.length}명을 설정에 저장했습니다.`);
}

/** 텍스트/CSV 파일을 골라 학생 목록으로 가져옵니다. */
async function importStudents() {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: "가져오기",
    filters: { "학생 목록": ["txt", "csv"], "모든 파일": ["*"] },
  });

  if (!picked || picked.length === 0) {
    return;
  }

  const bytes = await vscode.workspace.fs.readFile(picked[0]);
  const students = parseStudents(Buffer.from(bytes).toString("utf8"));

  if (students.length === 0) {
    vscode.window.showErrorMessage("파일에서 이름을 찾지 못했습니다. 쉼표 또는 줄바꿈으로 구분된 파일이어야 합니다.");
    return;
  }

  await saveStudents(students);
}

function getNonce() {
  return Array.from({ length: 32 }, () =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(
      Math.floor(Math.random() * 62)
    )
  ).join("");
}

/**
 * 웹뷰용 HTML을 만듭니다.
 * 상대경로(styles.css / script.js)는 asWebviewUri로 바꿔야 로드됩니다.
 */
function buildHtml(webview, extensionUri) {
  const nonce = getNonce();
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "styles.css"));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "script.js"));

  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource}`,
    `font-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>자리 배치 프로그램</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <main class="app">
    <section class="panel">
      <div class="layout">
        <section class="content">
          <div class="panel__header">
            <div>
              <p class="eyebrow">Classroom Seat Shuffle</p>
              <h1>자리 배치 프로그램</h1>
              <p class="description">사용하지 않는 자리를 클릭한 뒤, 원하는 자리끼리 드래그해서 바꿀 수 있습니다.</p>
            </div>
          </div>

          <div class="legend">
            <span><i class="legend__dot legend__dot--active"></i> 사용 중 좌석</span>
            <span><i class="legend__dot legend__dot--disabled"></i> 사용 안 함</span>
          </div>

          <section class="classroom">
            <div class="classroom__labels">
              <div class="room-label room-label--entrance">입구</div>
              <div class="room-label room-label--teacher">강사석</div>
            </div>
            <div id="seatGrid" class="seat-grid" aria-label="자리 배치"></div>
          </section>
        </section>

        <aside class="sidebar" aria-label="좌석 현황">
          <button id="shuffleButton" class="shuffle-button" type="button">자리 다시 섞기</button>

          <section class="stats" aria-label="현재 자리 현황">
            <article class="stat-card">
              <p class="stat-card__label">현재 좌석</p>
              <strong id="currentSeatCount" class="stat-card__value">-</strong>
            </article>
            <article class="stat-card">
              <p class="stat-card__label">사용하는 좌석 수</p>
              <strong id="activeSeatCount" class="stat-card__value">-</strong>
            </article>
            <article class="stat-card">
              <p class="stat-card__label">전체 학생 수</p>
              <strong id="studentCount" class="stat-card__value">-</strong>
            </article>
          </section>

          <p id="sourceNote" class="source-note"></p>

          <section class="editor" aria-label="학생 목록 편집">
            <button id="editToggle" class="ghost-button" type="button">학생 목록 편집</button>
            <div id="editorBox" class="editor__box" hidden>
              <textarea id="studentInput" class="editor__input" rows="9" spellcheck="false"
                placeholder="이름을 쉼표 또는 줄바꿈으로 구분해 입력하세요"></textarea>
              <div class="editor__actions">
                <button id="saveStudents" class="shuffle-button shuffle-button--sm" type="button">저장</button>
                <button id="cancelEdit" class="ghost-button" type="button">취소</button>
              </div>
              <p class="editor__hint">사용자 설정에 저장되어 Settings Sync로 다른 코퓨턴에도 전달됩니다.</p>
            </div>
          </section>
        </aside>
      </div>
    </section>
  </main>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

async function sendInit(context) {
  if (!panel) {
    return;
  }

  const config = vscode.workspace.getConfiguration("seatingArrangement");
  const { students, source } = await loadStudents(context);

  panel.webview.postMessage({
    type: "init",
    students,
    source,
    rows: config.get("rows", 6),
    cols: config.get("cols", 5),
    saved: context.workspaceState.get(STATE_KEY, null),
  });
}

async function openPanel(context) {
  if (panel) {
    panel.reveal();
    return;
  }

  panel = vscode.window.createWebviewPanel(
    "seatingArrangement",
    "자리 배치",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
    }
  );

  panel.webview.html = buildHtml(panel.webview, context.extensionUri);

  panel.webview.onDidReceiveMessage(async (message) => {
    switch (message.type) {
      case "ready":
        await sendInit(context);
        break;
      case "persist":
        await context.workspaceState.update(STATE_KEY, message.layout);
        break;
      case "warn":
        vscode.window.showWarningMessage(message.text);
        break;
      case "saveStudents":
        await saveStudents(message.students);
        break;
    }
  }, undefined, context.subscriptions);

  panel.onDidDispose(() => {
    panel = null;
  }, null, context.subscriptions);
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("seatingArrangement.open", () => openPanel(context)),
    vscode.commands.registerCommand("seatingArrangement.importStudents", () => importStudents()),
    vscode.commands.registerCommand("seatingArrangement.reloadStudents", async () => {
      if (!panel) {
        await openPanel(context);
        return;
      }
      await context.workspaceState.update(STATE_KEY, null);
      await sendInit(context);
      vscode.window.showInformationMessage("학생 목록을 다시 읽고 자리를 새로 배치했습니다.");
    }),
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration("seatingArrangement")) {
        await context.workspaceState.update(STATE_KEY, null);
        await sendInit(context);
      }
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
