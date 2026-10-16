const vscode = acquireVsCodeApi();

const seatGrid = document.getElementById("seatGrid");
const shuffleButton = document.getElementById("shuffleButton");
const currentSeatCount = document.getElementById("currentSeatCount");
const activeSeatCount = document.getElementById("activeSeatCount");
const studentCount = document.getElementById("studentCount");
const sourceNote = document.getElementById("sourceNote");
const editToggle = document.getElementById("editToggle");
const editorBox = document.getElementById("editorBox");
const studentInput = document.getElementById("studentInput");
const saveStudentsButton = document.getElementById("saveStudents");
const cancelEditButton = document.getElementById("cancelEdit");

const DISABLED = "사용 안 함";
const EMPTY = "빈자리";

let ROWS = 6;
let COLS = 5;
let totalSeats = ROWS * COLS;
let students = [];
let disabledSeats = new Set();
let seatAssignments = new Map();
let draggedSeatNumber = null;
let warnedOverflow = false;

function shuffle(list) {
  const copied = [...list];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function persist() {
  vscode.postMessage({
    type: "persist",
    layout: {
      rows: ROWS,
      cols: COLS,
      disabledSeats: [...disabledSeats],
      assignments: [...seatAssignments],
    },
  });
}

function resetSeatAssignments() {
  const shuffledStudents = shuffle(students);
  const assignments = new Map();
  let studentIndex = 0;

  for (let seatNumber = 1; seatNumber <= totalSeats; seatNumber += 1) {
    if (disabledSeats.has(seatNumber)) {
      assignments.set(seatNumber, DISABLED);
    } else {
      assignments.set(seatNumber, shuffledStudents[studentIndex] || EMPTY);
      studentIndex += 1;
    }
  }

  seatAssignments = assignments;

  const leftOver = students.length - (totalSeats - disabledSeats.size);
  if (leftOver > 0 && !warnedOverflow) {
    warnedOverflow = true;
    vscode.postMessage({
      type: "warn",
      text: `좌석이 부족해 학생 ${leftOver}명이 배치되지 않았습니다. 행/열 수를 늘려주세요.`,
    });
  }
}

function updateStats() {
  currentSeatCount.textContent = String(totalSeats);
  activeSeatCount.textContent = String(totalSeats - disabledSeats.size);
  studentCount.textContent = String(students.length);
}

function swapSeatAssignments(sourceSeatNumber, targetSeatNumber) {
  const sourceName = seatAssignments.get(sourceSeatNumber);
  const targetName = seatAssignments.get(targetSeatNumber);

  if (sourceName === undefined || targetName === undefined) {
    return;
  }

  if (sourceName === DISABLED || targetName === DISABLED) {
    return;
  }

  seatAssignments.set(sourceSeatNumber, targetName);
  seatAssignments.set(targetSeatNumber, sourceName);
}

function createSeatElement(seatNumber, assignedName) {
  let name = assignedName;
  const seat = document.createElement("button");
  seat.type = "button";
  seat.className = "seat";
  seat.dataset.seatNumber = String(seatNumber);
  seat.draggable = !disabledSeats.has(seatNumber);

  const colIndex = (seatNumber - 1) % COLS;
  if (colIndex === Math.floor((COLS - 1) / 2)) {
    seat.classList.add("seat--aisle");
  }

  if (disabledSeats.has(seatNumber)) {
    seat.classList.add("seat--disabled");
    name = DISABLED;
  } else if (name === EMPTY) {
    seat.classList.add("seat--empty");
  }

  const numberEl = document.createElement("div");
  numberEl.className = "seat__number";
  numberEl.textContent = `${seatNumber}번`;

  const nameEl = document.createElement("div");
  nameEl.className = "seat__name";
  nameEl.textContent = name;

  seat.append(numberEl, nameEl);

  seat.addEventListener("click", () => {
    toggleSeat(seatNumber);
  });

  seat.addEventListener("dragstart", (event) => {
    if (disabledSeats.has(seatNumber) || name === DISABLED) {
      event.preventDefault();
      return;
    }

    draggedSeatNumber = seatNumber;
    seat.classList.add("seat--dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(seatNumber));
  });

  seat.addEventListener("dragend", () => {
    draggedSeatNumber = null;
    seat.classList.remove("seat--dragging");
  });

  seat.addEventListener("dragover", (event) => {
    if (disabledSeats.has(seatNumber)) {
      return;
    }

    event.preventDefault();
    seat.classList.add("seat--drop-target");
  });

  seat.addEventListener("dragleave", () => {
    seat.classList.remove("seat--drop-target");
  });

  seat.addEventListener("drop", (event) => {
    event.preventDefault();
    seat.classList.remove("seat--drop-target");

    if (draggedSeatNumber === null || draggedSeatNumber === seatNumber) {
      return;
    }

    if (disabledSeats.has(seatNumber)) {
      return;
    }

    swapSeatAssignments(draggedSeatNumber, seatNumber);
    draggedSeatNumber = null;
    renderSeats();
  });

  return seat;
}

function renderSeats() {
  seatGrid.style.setProperty("--seat-cols", String(COLS));
  seatGrid.textContent = "";

  for (let seatNumber = 1; seatNumber <= totalSeats; seatNumber += 1) {
    const name = seatAssignments.get(seatNumber) || EMPTY;
    seatGrid.appendChild(createSeatElement(seatNumber, name));
  }

  updateStats();
  persist();
}

function toggleSeat(seatNumber) {
  if (disabledSeats.has(seatNumber)) {
    disabledSeats.delete(seatNumber);
    const currentName = seatAssignments.get(seatNumber);
    if (currentName === DISABLED || currentName === undefined) {
      seatAssignments.set(seatNumber, EMPTY);
    }
  } else {
    disabledSeats.add(seatNumber);
    seatAssignments.set(seatNumber, DISABLED);
  }

  renderSeats();
}

shuffleButton.addEventListener("click", () => {
  warnedOverflow = false;
  resetSeatAssignments();
  renderSeats();
});

function openEditor() {
  studentInput.value = students.join("\n");
  editorBox.hidden = false;
  editToggle.hidden = true;
  studentInput.focus();
}

function closeEditor() {
  editorBox.hidden = true;
  editToggle.hidden = false;
}

editToggle.addEventListener("click", openEditor);
cancelEditButton.addEventListener("click", closeEditor);

saveStudentsButton.addEventListener("click", () => {
  const parsed = studentInput.value
    .split(/[,\r\n\t]+/)
    .map((name) => name.trim())
    .filter(Boolean);

  if (parsed.length === 0) {
    return;
  }

  closeEditor();
  // 설정에 저장하고, 설정 변경 이벤트로 init이 다시 내려오며 재배치됩니다.
  vscode.postMessage({ type: "saveStudents", students: parsed });
});

window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type !== "init") {
    return;
  }

  ROWS = message.rows;
  COLS = message.cols;
  totalSeats = ROWS * COLS;
  students = message.students ?? [];
  sourceNote.textContent = `학생 목록: ${message.source} (${students.length}명)`;
  closeEditor();

  const saved = message.saved;
  if (saved && saved.rows === ROWS && saved.cols === COLS) {
    disabledSeats = new Set(saved.disabledSeats);
    seatAssignments = new Map(saved.assignments);
  } else {
    disabledSeats = new Set();
    resetSeatAssignments();
  }

  renderSeats();
});

vscode.postMessage({ type: "ready" });
