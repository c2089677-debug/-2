export function getCardSet(playerCount) {
  let cards = [];
  if (playerCount === 3) cards = ['Werewolf', 'Traitor', 'Villager', 'Villager', 'Fortune Teller', 'Police'];
  else if (playerCount === 4) cards = ['Werewolf', 'Traitor', 'Villager', 'Villager', 'Villager', 'Fortune Teller', 'Police', 'Ghost'];
  else if (playerCount === 5) cards = ['Werewolf', 'Werewolf', 'Traitor', 'Villager', 'Villager', 'Villager', 'Fortune Teller', 'Police', 'DJ', 'Ghost'];
  else if (playerCount === 6) cards = ['Werewolf', 'Werewolf', 'Traitor', 'Traitor', 'Villager', 'Villager', 'Villager', 'Villager', 'Fortune Teller', 'Police', 'DJ', 'Ghost'];
  else if (playerCount === 7) cards = ['Werewolf', 'Werewolf', 'Traitor', 'Traitor', 'Villager', 'Villager', 'Villager', 'Villager', 'Villager', 'Fortune Teller', 'Police', 'DJ', 'Ghost'];
  else if (playerCount === 8) cards = ['Werewolf', 'Werewolf', 'Werewolf', 'Traitor', 'Traitor', 'Villager', 'Villager', 'Villager', 'Villager', 'Villager', 'Fortune Teller', 'Police', 'DJ', 'Ghost'];
  else throw new Error("Unsupported player count");

  return cards.sort(() => Math.random() - 0.5);
}

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code;
  do {
    code = '';
    for(let i=0; i<4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  } while (rooms.has(code));
  return code;
}

export class Room {
  constructor(code) {
    this.code = code;
    this.players = new Map();
    this.phase = 'lobby';
    this.votes = new Map();
    this.dawnActions = new Map();
    this.afternoonActions = new Map();
    this.eliminatedPlayer = null;
    this.winner = null;
  }
}

export function createRoom(hostSocketId, hostName) {
  const code = generateRoomCode();
  const room = new Room(code);
  rooms.set(code, room);
  room.players.set(hostSocketId, {
    id: hostSocketId,
    name: hostName,
    playCard: null,
    fieldCard: null,
    card1: null,
    card2: null,
    hasSelected: false,
    isHost: true
  });
  return code;
}

export function joinRoom(roomCode, socketId, playerName) {
  const room = rooms.get(roomCode);
  if (!room) return { error: "Room not found" };
  if (room.phase !== 'lobby') return { error: "Game already started" };
  if (room.players.size >= 8) return { error: "Room is full" };
  if (room.players.has(socketId)) return { error: "Already in room" };
  
  room.players.set(socketId, {
    id: socketId,
    name: playerName,
    playCard: null,
    fieldCard: null,
    card1: null,
    card2: null,
    hasSelected: false,
    isHost: false
  });
  return room;
}

export function findRandomRoom(socketId, playerName) {
  // Find a room in 'lobby' phase with space
  for (const [code, room] of rooms.entries()) {
    if (room.phase === 'lobby' && room.players.size < 8) {
      joinRoom(code, socketId, playerName);
      return code;
    }
  }
  // If no room found, create a new one
  return createRoom(socketId, playerName);
}

export function leaveRoom(roomCode, socketId) {
  const room = rooms.get(roomCode);
  if (room) {
    room.players.delete(socketId);
    if (room.players.size === 0) {
      rooms.delete(roomCode);
    } else {
      const players = Array.from(room.players.values());
      if (!players.find(p => p.isHost)) {
        players[0].isHost = true;
      }
    }
  }
}

export function getRoom(roomCode) {
  return rooms.get(roomCode);
}

export function startGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Room not found");
  
  const cards = getCardSet(room.players.size);
  let cIdx = 0;
  for (const player of room.players.values()) {
    player.card1 = cards[cIdx++];
    player.card2 = cards[cIdx++];
    player.hasSelected = false;
    player.playCard = null;
    player.fieldCard = null;
  }
  
  room.phase = 'selecting';
  room.votes.clear();
  room.dawnActions.clear();
  room.afternoonActions.clear();
  room.eliminatedPlayer = null;
  room.winner = null;
}

export function selectCard(roomCode, socketId, cardIndex) {
  const room = rooms.get(roomCode);
  if (!room) throw new Error("Room not found");
  const player = room.players.get(socketId);
  if (!player) throw new Error("Player not found");
  
  if (cardIndex === 0) {
    player.playCard = player.card1;
    player.fieldCard = player.card2;
  } else {
    player.playCard = player.card2;
    player.fieldCard = player.card1;
  }
  player.hasSelected = true;
}

export function allCardsSelected(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return false;
  return Array.from(room.players.values()).every(p => p.hasSelected);
}

export function getDawnActors(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return [];
  const actors = [];
  for (const player of room.players.values()) {
    if (player.playCard === 'Werewolf' || player.playCard === 'Fortune Teller' || player.playCard === 'Traitor') {
      actors.push(player.id);
    }
  }
  return actors;
}

export function executeDawnAction(roomCode, actorId, targetId) {
  const room = rooms.get(roomCode);
  if (!room) return null;
  const actor = room.players.get(actorId);
  if (!actor) return null;
  
  room.dawnActions.set(actorId, { done: true, targetId });
  
  if (actor.playCard === 'Fortune Teller') {
    const target = room.players.get(targetId);
    return target ? target.playCard : null;
  } else if (actor.playCard === 'Werewolf') {
    const otherWerewolves = [];
    for (const player of room.players.values()) {
      if (player.id !== actorId && player.playCard === 'Werewolf') {
        otherWerewolves.push(player.name);
      }
    }
    return otherWerewolves;
  } else if (actor.playCard === 'Traitor') {
    // Traitor learns who the werewolves are
    const werewolves = [];
    for (const player of room.players.values()) {
      if (player.playCard === 'Werewolf') {
        werewolves.push(player.name);
      }
    }
    return werewolves;
  }
  return null;
}

export function getAfternoonActors(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return [];
  const actors = [];
  for (const player of room.players.values()) {
    if (player.playCard === 'Police' || player.playCard === 'DJ') {
      actors.push(player.id);
    }
  }
  return actors;
}

export function executeAfternoonAction(roomCode, actorId, targetId) {
  const room = rooms.get(roomCode);
  if (!room) return null;
  const actor = room.players.get(actorId);
  if (!actor) return null;
  
  room.afternoonActions.set(actorId, { done: true, targetId });
  
  if (actor.playCard === 'Police') {
    const target = room.players.get(targetId);
    return target ? target.fieldCard : null;
  } else if (actor.playCard === 'DJ') {
    const target = room.players.get(targetId);
    if (target) {
      const temp = target.playCard;
      target.playCard = target.fieldCard;
      target.fieldCard = temp;
      return true;
    }
  }
  return null;
}

export function castVote(roomCode, voterId, targetId) {
  const room = rooms.get(roomCode);
  if (room) {
    room.votes.set(voterId, targetId);
  }
}

export function allVotesCast(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return false;
  return room.votes.size === room.players.size;
}

export function resolveVotes(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return null;
  
  const voteCounts = new Map();
  for (const targetId of room.votes.values()) {
    voteCounts.set(targetId, (voteCounts.get(targetId) || 0) + 1);
  }
  
  let maxVotes = 0;
  let eliminatedId = null;
  let tie = false;
  
  for (const [targetId, count] of voteCounts.entries()) {
    if (count > maxVotes) {
      maxVotes = count;
      eliminatedId = targetId;
      tie = false;
    } else if (count === maxVotes) {
      tie = true;
    }
  }
  
  if (tie) {
    room.eliminatedPlayer = null;
    room.winner = 'werewolf';
  } else {
    room.eliminatedPlayer = eliminatedId;
    const eliminated = room.players.get(eliminatedId);
    if (eliminated.playCard === 'Werewolf') {
      room.winner = 'village';
    } else if (eliminated.playCard === 'Ghost') {
      room.winner = 'ghost';
    } else {
      room.winner = 'werewolf';
    }
  }
  
  room.phase = 'result';
  return { eliminatedPlayer: room.eliminatedPlayer, winner: room.winner, votes: Object.fromEntries(room.votes) };
}

export function getGameResult(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return null;
  
  const playersData = [];
  for (const player of room.players.values()) {
    playersData.push({
      id: player.id,
      name: player.name,
      playCard: player.playCard,
      fieldCard: player.fieldCard
    });
  }
  
  return {
    winner: room.winner,
    players: playersData
  };
}

export function resetGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  room.phase = 'lobby';
  for (const player of room.players.values()) {
    player.playCard = null;
    player.fieldCard = null;
    player.card1 = null;
    player.card2 = null;
    player.hasSelected = false;
  }
  room.votes.clear();
  room.dawnActions.clear();
  room.afternoonActions.clear();
  room.eliminatedPlayer = null;
  room.winner = null;
}
