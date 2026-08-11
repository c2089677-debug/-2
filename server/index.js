import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as game from './gameLogic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());

// Serve static client files (built Vite app)
app.use(express.static(join(__dirname, '../client/dist')));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

function emitRoomUpdated(io, roomCode) {
  const room = game.getRoom(roomCode);
  if (!room) return;
  const players = Array.from(room.players.values()).map(p => ({
    id: p.id,
    name: p.name,
    isHost: p.isHost,
    hasSelected: p.hasSelected
  }));
  io.to(roomCode).emit('room-updated', { roomCode, players, phase: room.phase });
}

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('create-room', ({ playerName }) => {
    try {
      const roomCode = game.createRoom(socket.id, playerName);
      currentRoom = roomCode;
      socket.join(roomCode);
      const room = game.getRoom(roomCode);
      const players = Array.from(room.players.values()).map(p => ({ id: p.id, name: p.name, isHost: p.isHost }));
      socket.emit('room-created', { roomCode, players });
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('join-random-room', ({ playerName }) => {
    try {
      const roomCode = game.findRandomRoom(socket.id, playerName);
      currentRoom = roomCode;
      socket.join(roomCode);
      const room = game.getRoom(roomCode);
      // If player is the host (first player), trigger room-created
      const me = room.players.get(socket.id);
      if (me.isHost) {
        const players = Array.from(room.players.values()).map(p => ({ id: p.id, name: p.name, isHost: p.isHost }));
        socket.emit('room-created', { roomCode, players });
      } else {
        emitRoomUpdated(io, roomCode);
      }
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('join-room', ({ roomCode, playerName }) => {
    try {
      const result = game.joinRoom(roomCode, socket.id, playerName);
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }
      currentRoom = roomCode;
      socket.join(roomCode);
      emitRoomUpdated(io, roomCode);
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('leave-room', () => {
    if (currentRoom) {
      game.leaveRoom(currentRoom, socket.id);
      socket.leave(currentRoom);
      emitRoomUpdated(io, currentRoom);
      currentRoom = null;
    }
  });

  socket.on('start-game', () => {
    if (!currentRoom) return;
    try {
      game.startGame(currentRoom);
      const room = game.getRoom(currentRoom);
      emitRoomUpdated(io, currentRoom);
      
      for (const player of room.players.values()) {
        io.to(player.id).emit('cards-dealt', { card1: player.card1, card2: player.card2 });
      }
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('select-card', ({ cardIndex }) => {
    if (!currentRoom) return;
    try {
      game.selectCard(currentRoom, socket.id, cardIndex);
      const room = game.getRoom(currentRoom);
      emitRoomUpdated(io, currentRoom);
      
      if (game.allCardsSelected(currentRoom)) {
        room.phase = 'dawn';
        io.to(currentRoom).emit('phase-changed', { phase: 'dawn' });
      }
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  const checkDawnFinished = (roomCode) => {
    const room = game.getRoom(roomCode);
    const actors = game.getDawnActors(roomCode);
    const allDone = actors.every(actorId => room.dawnActions.has(actorId));
    if (allDone) {
      room.phase = 'day';
      io.to(roomCode).emit('phase-changed', { phase: 'day' });
    }
  };

  socket.on('dawn-action', ({ targetId }) => {
    if (!currentRoom) return;
    try {
      const result = game.executeDawnAction(currentRoom, socket.id, targetId);
      if (result !== null) {
        socket.emit('dawn-result', { targetRole: result });
      }
      checkDawnFinished(currentRoom);
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('dawn-skip', () => {
    if (!currentRoom) return;
    checkDawnFinished(currentRoom);
  });

  const checkAfternoonFinished = (roomCode) => {
    const room = game.getRoom(roomCode);
    const actors = game.getAfternoonActors(roomCode);
    const allDone = actors.every(actorId => room.afternoonActions.has(actorId));
    if (allDone) {
      room.phase = 'vote';
      io.to(roomCode).emit('phase-changed', { phase: 'vote' });
    }
  };

  socket.on('afternoon-action', ({ targetId }) => {
    if (!currentRoom) return;
    try {
      const result = game.executeAfternoonAction(currentRoom, socket.id, targetId);
      if (result !== null) {
        socket.emit('afternoon-result', { result });
      }
      checkAfternoonFinished(currentRoom);
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('afternoon-skip', () => {
    if (!currentRoom) return;
    checkAfternoonFinished(currentRoom);
  });

  socket.on('end-day', () => {
    if (!currentRoom) return;
    const room = game.getRoom(currentRoom);
    if (!room) return;
    // Only host can end day
    const player = room.players.get(socket.id);
    if (!player || !player.isHost) return;
    
    if (room.phase === 'day') {
      const actors = game.getAfternoonActors(currentRoom);
      if (actors.length === 0) {
        // No afternoon actors, skip to vote
        room.phase = 'vote';
        io.to(currentRoom).emit('phase-changed', { phase: 'vote' });
      } else {
        room.phase = 'afternoon';
        io.to(currentRoom).emit('phase-changed', { phase: 'afternoon' });
      }
    }
  });

  socket.on('cast-vote', ({ targetId }) => {
    if (!currentRoom) return;
    try {
      game.castVote(currentRoom, socket.id, targetId);
      if (game.allVotesCast(currentRoom)) {
        const { eliminatedPlayer, winner, votes } = game.resolveVotes(currentRoom);
        const room = game.getRoom(currentRoom);
        const eliminatedName = eliminatedPlayer ? room.players.get(eliminatedPlayer).name : null;
        io.to(currentRoom).emit('vote-result', { eliminatedId: eliminatedPlayer, eliminatedName, votes });
      }
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('show-result', () => {
    if (!currentRoom) return;
    try {
      const result = game.getGameResult(currentRoom);
      io.to(currentRoom).emit('game-result', result);
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('play-again', () => {
    if (!currentRoom) return;
    try {
      game.resetGame(currentRoom);
      emitRoomUpdated(io, currentRoom);
    } catch (e) {
      socket.emit('error', { message: e.message });
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom) {
      game.leaveRoom(currentRoom, socket.id);
      emitRoomUpdated(io, currentRoom);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
