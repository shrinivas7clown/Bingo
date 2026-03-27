const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let rooms = {};

io.on("connection", (socket) => {

  // JOIN ROOM
  socket.on("joinRoom", ({ roomId, name }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        calledNumbers: [],
        turnIndex: 0,
        host: socket.id,
        started: false
      };
    }

    let room = rooms[roomId];

    if (!room.players.find(p => p.id === socket.id)) {
      room.players.push({
        id: socket.id,
        name: name
      });
    }

    io.to(roomId).emit("players", room.players);
    io.to(roomId).emit("host", room.host);
  });

  // START GAME
  socket.on("startGame", (roomId) => {
    let room = rooms[roomId];
    if (!room) return;

    if (room.host !== socket.id) return;

    if (room.players.length < 2) {
      socket.emit("errorMsg", "Need at least 2 players to start");
      return;
    }

    room.started = true;
    room.calledNumbers = [];
    room.turnIndex = 0;

    io.to(roomId).emit("gameStarted");

    io.to(roomId).emit(
      "turn",
      room.players[room.turnIndex].id
    );
  });

  // PLAYER NUMBER
  socket.on("myNumber", ({ roomId, number }) => {
    let room = rooms[roomId];
    if (!room || !room.started) return;

    let currentPlayer = room.players[room.turnIndex];

    if (!currentPlayer || currentPlayer.id !== socket.id) return;
    if (room.calledNumbers.includes(number)) return;

    room.calledNumbers.push(number);

    io.to(roomId).emit("number", number);

    room.turnIndex = (room.turnIndex + 1) % room.players.length;

    io.to(roomId).emit(
      "turn",
      room.players[room.turnIndex].id
    );
  });

  // 🎵 MUSIC SYNC (NEW FEATURE 🔥)
  socket.on("musicAction", ({ roomId, action, songIndex }) => {
    io.to(roomId).emit("musicAction", { action, songIndex });
  });

  // BINGO
  socket.on("bingo", ({ roomId, name }) => {
    let room = rooms[roomId];
    if (!room) return;

    room.started = false;

    io.to(roomId).emit("winner", name);
  });

  // DISCONNECT HANDLING
  socket.on("disconnect", () => {

    for (let roomId in rooms) {
      let room = rooms[roomId];

      let index = room.players.findIndex(p => p.id === socket.id);

      if (index !== -1) {
        room.players.splice(index, 1);

        if (room.host === socket.id && room.players.length > 0) {
          room.host = room.players[0].id;
        }

        if (room.turnIndex >= room.players.length) {
          room.turnIndex = 0;
        }

        io.to(roomId).emit("players", room.players);
        io.to(roomId).emit("host", room.host);

        if (room.players.length === 0) {
          delete rooms[roomId];
        }

        break;
      }
    }

  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running");
});