const socket = io();

let selectedNumber = null;
let myId = null;
let playersList = [];
let isHost = false;
let gameStarted = false;

/* ================= MUSIC SYSTEM ================= */

let songs = [
  "songs/SUICIDAL_IDOL_ecstacy.mp3",
  "songs/song2.mp3",
  "songs/song3.mp3"
];

let currentSongIndex = 0;
let audio = new Audio();

// Load song list UI
function loadSongs() {
  const list = document.getElementById("songList");
  if (!list) return;

  list.innerHTML = "";

  songs.forEach((song, index) => {
    let li = document.createElement("li");

    li.innerText = song.split("/").pop();

    li.onclick = () => {
      currentSongIndex = index;
      sendMusicAction("play", index);
    };

    list.appendChild(li);
  });
}

// Send music action to server
function sendMusicAction(action, index = currentSongIndex) {
  const room = document.getElementById("room").value;

  socket.emit("musicAction", {
    roomId: room,
    action: action,
    songIndex: index
  });
}

// Controls
function playSong() {
  sendMusicAction("play", currentSongIndex);
}

function pauseSong() {
  sendMusicAction("pause");
}

function nextSong() {
  currentSongIndex = (currentSongIndex + 1) % songs.length;
  sendMusicAction("play", currentSongIndex);
}

// Receive synced music
socket.on("musicAction", ({ action, songIndex }) => {

  if (songIndex !== undefined) {
    currentSongIndex = songIndex;
    audio.src = songs[currentSongIndex];
  }

  if (action === "play") {
    audio.play();
  }

  if (action === "pause") {
    audio.pause();
  }
});

/* ================= GAME SYSTEM ================= */

// JOIN
function joinRoom() {
  const name = document.getElementById("name").value;
  const room = document.getElementById("room").value;

  socket.emit("joinRoom", { roomId: room, name });

  document.getElementById("lobby").style.display = "block";
  document.getElementById("status").innerText = "Waiting for players...";

  loadSongs(); // 🔥 load music list
}

// CREATE BOARD
function createBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  let numbers = Array.from({ length: 25 }, (_, i) => i + 1);
  numbers.sort(() => Math.random() - 0.5);

  numbers.forEach(num => {
    let cell = document.createElement("div");
    cell.innerText = num;
    cell.classList.add("cell");

    cell.onclick = () => {
      if (!gameStarted) return;

      selectedNumber = num;

      document.querySelectorAll("#board div").forEach(c => c.style.outline = "none");
      cell.style.outline = "3px solid yellow";
    };

    board.appendChild(cell);
  });
}

// PLAYERS
socket.on("players", (players) => {
  playersList = players;

  const ul = document.getElementById("players");
  ul.innerHTML = "";

  players.forEach(p => {
    let li = document.createElement("li");
    li.innerText = p.name;
    ul.appendChild(li);
  });

  document.getElementById("status").innerText =
    players.length < 2 ? "Waiting for more players..." : "Ready to start!";
});

// HOST
socket.on("host", (hostId) => {
  if (socket.id === hostId) {
    isHost = true;
    document.getElementById("startBtn").style.display = "inline-block";
  }
});

// START GAME
function startGame() {
  const room = document.getElementById("room").value;
  socket.emit("startGame", room);
}

// GAME START
socket.on("gameStarted", () => {
  gameStarted = true;

  document.getElementById("lobby").style.display = "none";
  document.getElementById("game").classList.remove("hidden");

  createBoard();
});

// TURN
socket.on("turn", (id) => {
  myId = socket.id;

  const btn = document.getElementById("myBtn");
  const currentPlayer = playersList.find(p => p.id === id);

  if (id === myId) {
    document.getElementById("turnText").innerText = "👉 Your Turn";
    btn.disabled = false;
  } else {
    document.getElementById("turnText").innerText = `⏳ ${currentPlayer?.name}'s Turn`;
    btn.disabled = true;
  }
});

// SEND NUMBER
function sendNumber() {
  const room = document.getElementById("room").value;

  if (!selectedNumber) {
    alert("Select a number first");
    return;
  }

  socket.emit("myNumber", {
    roomId: room,
    number: selectedNumber
  });

  selectedNumber = null;
}

// RECEIVE NUMBER
socket.on("number", (num) => {
  document.getElementById("number").innerText = "🎯 " + num;

  document.querySelectorAll("#board div").forEach(cell => {
    if (parseInt(cell.innerText) === num) {
      cell.classList.add("marked");
    }
  });

  checkLines();
});

// STRIKE LINES
function checkLines() {
  const cells = document.querySelectorAll("#board div");

  let grid = [];
  cells.forEach(c => grid.push(c.classList.contains("marked")));

  let lines = [];

  for (let i = 0; i < 5; i++) {
    lines.push({ idx: [i*5, i*5+1, i*5+2, i*5+3, i*5+4], type: "row" });
    lines.push({ idx: [i, i+5, i+10, i+15, i+20], type: "col" });
  }

  lines.push({ idx: [0,6,12,18,24], type: "diag1" });
  lines.push({ idx: [4,8,12,16,20], type: "diag2" });

  lines.forEach(line => {
    if (line.idx.every(i => grid[i])) {
      line.idx.forEach(i => {
        if (line.type === "row") cells[i].classList.add("strike-row");
        if (line.type === "col") cells[i].classList.add("strike-col");
        if (line.type === "diag1") cells[i].classList.add("strike-diag1");
        if (line.type === "diag2") cells[i].classList.add("strike-diag2");
      });
    }
  });
}

// BINGO CHECK
function checkBingo() {
  const cells = document.querySelectorAll("#board div");

  let grid = [];
  cells.forEach(c => grid.push(c.classList.contains("marked")));

  let count = 0;
  let lines = [];

  for (let i = 0; i < 5; i++) {
    lines.push([i*5, i*5+1, i*5+2, i*5+3, i*5+4]);
    lines.push([i, i+5, i+10, i+15, i+20]);
  }

  lines.push([0,6,12,18,24]);
  lines.push([4,8,12,16,20]);

  lines.forEach(line => {
    if (line.every(i => grid[i])) count++;
  });

  if (count >= 5) {
    const room = document.getElementById("room").value;
    const name = document.getElementById("name").value;

    socket.emit("bingo", { roomId: room, name });
  } else {
    alert("Not Bingo yet!");
  }
}

// WINNER
socket.on("winner", (name) => {
  document.getElementById("winner").innerText = "🏆 Winner: " + name;
});

// ERROR
socket.on("errorMsg", (msg) => {
  alert(msg);
});