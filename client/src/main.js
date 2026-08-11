import { io } from 'socket.io-client';
import { t, setLang, getLang, tRole, tRoleDesc } from './i18n.js';

const socket = io();

// ── Mapping: server role names → i18n keys ──
const ROLE_MAP = {
  'Werewolf': 'werewolf',
  'Traitor': 'traitor',
  'Villager': 'villager',
  'Fortune Teller': 'fortuneTeller',
  'Police': 'police',
  'DJ': 'dj',
  'Ghost': 'ghost'
};

const ROLE_EMOJIS = {
  werewolf: '🐺',
  traitor: '🗡️',
  villager: '👤',
  fortuneTeller: '🔮',
  police: '🚔',
  dj: '🎧',
  ghost: '👻'
};

function roleKey(serverRole) {
  return ROLE_MAP[serverRole] || serverRole;
}

function roleEmoji(serverRole) {
  return ROLE_EMOJIS[roleKey(serverRole)] || '❓';
}

// ── Game State ──
const state = {
  phase: 'home',
  roomCode: null,
  players: [],
  myId: null,
  isHost: false,
  myName: '',
  card1: null,       // server role name
  card2: null,
  myPlayCard: null,  // server role name (after selection)
  selectedIndex: null,
  dawnResultShown: false,
  afternoonResultShown: false,
  voteResultData: null,
  gameResultData: null,
};

// ── DOM helpers ──
const app = document.getElementById('app');

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function render(html, onMount) {
  app.innerHTML = '';

  // Language toggle button (always present)
  const langBtn = document.createElement('button');
  langBtn.className = 'lang-toggle';
  langBtn.textContent = getLang() === 'ja' ? '🇬🇧 EN' : '🇯🇵 JA';
  langBtn.onclick = () => {
    setLang(getLang() === 'ja' ? 'en' : 'ja');
    rerender();
  };
  app.appendChild(langBtn);

  const screen = document.createElement('div');
  screen.className = 'screen active';
  screen.innerHTML = html;
  app.appendChild(screen);

  if (onMount) onMount(screen);
}

function rerender() {
  switch (state.phase) {
    case 'home': renderHome(); break;
    case 'lobby': renderLobby(); break;
    case 'selecting': renderCardSelect(); break;
    case 'dawn': renderDawn(); break;
    case 'day': renderDay(); break;
    case 'afternoon': renderAfternoon(); break;
    case 'vote': renderVote(); break;
    case 'vote-result': renderVoteResult(); break;
    case 'result': renderResult(); break;
    default: renderHome();
  }
}

// ══════════════════════════════════════════════
// SCREENS
// ══════════════════════════════════════════════

function renderHome() {
  state.phase = 'home';
  render(`
    <div class="flex-center">
      <div style="font-size:4rem;margin-bottom:8px;">🐺</div>
      <h1>${t('appTitle')}</h1>
      <p>${t('appSubtitle')}</p>

      <div class="input-group" style="margin-top:32px;">
        <label>${t('yourName')}</label>
        <input type="text" id="inp-name" class="input" placeholder="Name" maxlength="10">
      </div>

      <button id="btn-random" class="btn primary" style="margin-bottom: 24px;">✨ ${t('randomMatch')}</button>
      <button id="btn-create" class="btn ghost" style="margin-bottom: 12px;">🏠 ${t('createRoom')}</button>

      <div style="margin:16px 0;width:100%;text-align:center;color:var(--text-light);font-weight:700;">─── OR ───</div>

      <div class="input-group">
        <label>${t('roomCode')}</label>
        <input type="text" id="inp-code" class="input" placeholder="${t('enterRoomCode')}" style="text-transform:uppercase;letter-spacing:4px;text-align:center;" maxlength="4">
      </div>
      <button id="btn-join" class="btn accent">${t('joinRoom')}</button>
    </div>
  `, (el) => {
    const nameInp = el.querySelector('#inp-name');
    const codeInp = el.querySelector('#inp-code');
    if (state.myName) nameInp.value = state.myName;

    el.querySelector('#btn-random').onclick = () => {
      const name = nameInp.value.trim();
      if (!name) return showToast(t('yourName'));
      state.myName = name;
      socket.emit('join-random-room', { playerName: name });
    };

    el.querySelector('#btn-create').onclick = () => {
      const name = nameInp.value.trim();
      if (!name) return showToast(t('yourName'));
      state.myName = name;
      socket.emit('create-room', { playerName: name });
    };

    el.querySelector('#btn-join').onclick = () => {
      const name = nameInp.value.trim();
      const code = codeInp.value.trim().toUpperCase();
      if (!name || !code || code.length < 4) return showToast(t('enterRoomCode'));
      state.myName = name;
      socket.emit('join-room', { roomCode: code, playerName: name });
    };
  });
}

// ── Lobby ──
function renderLobby() {
  state.phase = 'lobby';
  const playersHtml = state.players.map(p => `
    <li class="player-item">
      <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
      <div class="player-info">
        <span class="player-name">${p.name}${p.id === state.myId ? ` (${t('you')})` : ''}</span>
        ${p.isHost ? `<span class="player-badge">${t('host')}</span>` : ''}
      </div>
    </li>
  `).join('');

  const canStart = state.isHost && state.players.length >= 3;
  const startLabel = canStart
    ? t('startGame')
    : t('needMorePlayers', { n: Math.max(0, 3 - state.players.length) });

  render(`
    <h2>${t('roomCode')}</h2>
    <div class="room-code-display" id="copy-code">
      <h2>${state.roomCode}</h2>
      <p style="margin:8px 0 0;font-size:0.85rem;">${t('shareCode')} 📋</p>
    </div>

    <h3 style="text-align:center;">${t('players')} (${state.players.length}/8)</h3>
    <ul class="player-list">${playersHtml}</ul>

    ${state.isHost
      ? `<button id="btn-start" class="btn primary" ${canStart ? '' : 'disabled'}>${startLabel}</button>`
      : `<p class="pulse" style="text-align:center;color:var(--accent);font-weight:700;">${t('waitingForOthers')}</p>`
    }
    <button id="btn-leave" class="btn ghost">${t('backToHome')}</button>
  `, (el) => {
    el.querySelector('#copy-code').onclick = () => {
      navigator.clipboard?.writeText(state.roomCode);
      showToast(t('copied'));
    };
    const startBtn = el.querySelector('#btn-start');
    if (startBtn) startBtn.onclick = () => socket.emit('start-game');
    el.querySelector('#btn-leave').onclick = () => {
      socket.emit('leave-room');
      state.roomCode = null;
      renderHome();
    };
  });
}

// ── Card Selection ──
function renderCardSelect() {
  state.phase = 'selecting';
  const c1key = roleKey(state.card1);
  const c2key = roleKey(state.card2);

  render(`
    <div class="phase-banner" style="background:linear-gradient(135deg,var(--accent),#512DA8);">
      <h2>${t('chooseCard')}</h2>
    </div>
    <p style="text-align:center;">${t('chooseCard')}</p>
    <div class="card-container" id="cards-wrap"></div>
    <div id="confirm-wrap" style="text-align:center;display:none;">
      <p id="sel-label" style="font-weight:700;font-size:1.15rem;color:var(--primary);"></p>
      <button id="btn-confirm" class="btn primary">${t('confirm')}</button>
    </div>
  `, (el) => {
    const wrap = el.querySelector('#cards-wrap');
    const confirmWrap = el.querySelector('#confirm-wrap');
    const selLabel = el.querySelector('#sel-label');
    const btnConfirm = el.querySelector('#btn-confirm');

    let viewed = [false, false];
    let chosenIdx = null;

    [state.card1, state.card2].forEach((serverRole, idx) => {
      const key = roleKey(serverRole);
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-face card-back"></div>
        <div class="card-face card-front role-${key}">
          <div class="card-role-emoji">${ROLE_EMOJIS[key]}</div>
          <div class="card-role-name">${tRole(key)}</div>
          <div style="font-size:0.75rem;margin-top:8px;opacity:0.9;">${tRoleDesc(key)}</div>
        </div>
      `;
      card.onclick = () => {
        if (!viewed[idx]) {
          card.classList.add('flipped');
          viewed[idx] = true;
          return;
        }
        if (!viewed[0] || !viewed[1]) return;
        wrap.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        chosenIdx = idx;
        confirmWrap.style.display = 'block';
        selLabel.textContent = `${t('selectedCard')}: ${roleEmoji(serverRole)} ${tRole(key)}`;
      };
      wrap.appendChild(card);
    });

    btnConfirm.onclick = () => {
      if (chosenIdx === null) return;
      state.myPlayCard = chosenIdx === 0 ? state.card1 : state.card2;
      socket.emit('select-card', { cardIndex: chosenIdx });
      el.querySelector('.screen.active').innerHTML = `
        <div class="flex-center">
          <div style="font-size:3rem;" class="pulse">⏳</div>
          <h2>${t('waitingForOthers')}</h2>
        </div>`;
    };
  });
}

// ── Dawn Phase ──
function renderDawn() {
  state.phase = 'dawn';
  const rk = roleKey(state.myPlayCard);
  let bodyHtml = '';

  if (rk === 'werewolf') {
    // Werewolf auto-action: server returns fellow wolves
    bodyHtml = `
      <h3 style="text-align:center;">${t('youAreWerewolf')}</h3>
      <p style="text-align:center;">${t('noAbility')}</p>
      <div id="wolf-info" style="text-align:center;margin:16px 0;"></div>
    `;
  } else if (rk === 'fortuneTeller') {
    const others = state.players.filter(p => p.id !== state.myId);
    const opts = others.map(p => `
      <div class="grid-item" data-id="${p.id}">
        <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
        <div class="player-name">${p.name}</div>
      </div>
    `).join('');
    bodyHtml = `
      <h3 style="text-align:center;">${t('youAreFortuneTeller')}</h3>
      <p style="text-align:center;">${t('choosePeekTarget')}</p>
      <div class="player-grid">${opts}</div>
    `;
  } else if (rk === 'traitor') {
    bodyHtml = `
      <h3 style="text-align:center;">${t('youAreTraitor')}</h3>
      <p style="text-align:center;">${t('noAbility')}</p>
      <div id="traitor-info" style="text-align:center;margin:16px 0;"></div>
    `;
  } else {
    bodyHtml = `
      <h3 style="text-align:center;">${roleEmoji(state.myPlayCard)} ${tRole(rk)}</h3>
      <p style="text-align:center;">${t('noAbility')}</p>
    `;
  }

  render(`
    <div class="phase-banner" style="background:linear-gradient(135deg,#1A237E,#311B92);">
      <h2>${t('dawnPhase')}</h2>
      <p>${t('dawnDesc')}</p>
    </div>
    <div style="margin-bottom:24px;">${bodyHtml}</div>
    <div id="dawn-action" style="text-align:center;">
      <button id="btn-dawn" class="btn primary" ${rk === 'fortuneTeller' ? 'disabled' : ''}>
        ${rk === 'fortuneTeller' ? t('chooseTarget') : t('confirm')}
      </button>
    </div>
  `, (el) => {
    const btnDawn = el.querySelector('#btn-dawn');
    let selectedTarget = null;

    if (rk === 'werewolf') {
      // Auto emit dawn-action (no target needed, server returns fellow wolves)
      socket.emit('dawn-action', { targetId: null });
    } else if (rk === 'traitor') {
      // Auto emit dawn-action for traitor - server can reveal wolves
      socket.emit('dawn-action', { targetId: null });
    } else if (rk === 'fortuneTeller') {
      const items = el.querySelectorAll('.grid-item');
      items.forEach(item => {
        item.onclick = () => {
          items.forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          selectedTarget = item.dataset.id;
          btnDawn.disabled = false;
          btnDawn.textContent = t('confirm');
        };
      });
      btnDawn.onclick = () => {
        if (!selectedTarget) return;
        socket.emit('dawn-action', { targetId: selectedTarget });
        btnDawn.disabled = true;
        btnDawn.textContent = t('waiting');
      };
    } else {
      // No ability → skip
      btnDawn.onclick = () => {
        socket.emit('dawn-skip');
        showWaiting(el);
      };
    }
  });
}

// ── Day Phase ──
function renderDay() {
  state.phase = 'day';
  const playersHtml = state.players.map(p => `
    <div class="grid-item">
      <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
      <div class="player-name">${p.name}</div>
    </div>
  `).join('');

  render(`
    <div class="phase-banner" style="background:linear-gradient(135deg,#FFB300,#F57C00);">
      <h2>${t('dayPhase')}</h2>
      <p>${t('dayDesc')}</p>
    </div>
    <div class="timer" id="timer">03:00</div>
    <div class="player-grid" style="margin-bottom:24px;">${playersHtml}</div>
    ${state.isHost
      ? `<button id="btn-end-day" class="btn accent">⏭ End Discussion</button>`
      : `<p class="pulse" style="text-align:center;color:var(--accent);font-weight:700;">${t('waitingForOthers')}</p>`
    }
  `, (el) => {
    let timeLeft = 180;
    const timerEl = el.querySelector('#timer');
    const interval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(interval);
        timerEl.textContent = '00:00';
      } else {
        const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
        const s = String(timeLeft % 60).padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
      }
    }, 1000);

    const btnEnd = el.querySelector('#btn-end-day');
    if (btnEnd) {
      btnEnd.onclick = () => {
        clearInterval(interval);
        // Host manually triggers next phase
        // Server currently does not have a "end-day" event, so we emit afternoon-skip
        // or advance manually. We'll need to add a phase advance.
        // For now, the server auto-transitions dawn→day but day→afternoon is
        // triggered when afternoon actors are done. Let's emit a special event.
        // Since server doesn't have this, we'll add it. For now, show afternoon.
        socket.emit('end-day');
      };
    }
  });
}

// ── Afternoon Phase ──
function renderAfternoon() {
  state.phase = 'afternoon';
  const rk = roleKey(state.myPlayCard);
  let bodyHtml = '';

  if (rk === 'police') {
    const others = state.players.filter(p => p.id !== state.myId);
    const opts = others.map(p => `
      <div class="grid-item" data-id="${p.id}">
        <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
        <div class="player-name">${p.name}</div>
      </div>
    `).join('');
    bodyHtml = `
      <h3 style="text-align:center;">${t('youArePolice')}</h3>
      <p style="text-align:center;">${t('chooseFieldTarget')}</p>
      <div class="player-grid">${opts}</div>
    `;
  } else if (rk === 'dj') {
    const others = state.players.filter(p => p.id !== state.myId);
    const opts = others.map(p => `
      <div class="grid-item" data-id="${p.id}">
        <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
        <div class="player-name">${p.name}</div>
      </div>
    `).join('');
    bodyHtml = `
      <h3 style="text-align:center;">${t('youAreDJ')}</h3>
      <p style="text-align:center;">${t('chooseSwapTarget')}</p>
      <div class="player-grid">${opts}</div>
    `;
  } else {
    bodyHtml = `
      <h3 style="text-align:center;">${roleEmoji(state.myPlayCard)} ${tRole(rk)}</h3>
      <p style="text-align:center;">${t('noAbility')}</p>
    `;
  }

  render(`
    <div class="phase-banner" style="background:linear-gradient(135deg,#0288D1,#0097A7);">
      <h2>${t('afternoonPhase')}</h2>
      <p>${t('afternoonDesc')}</p>
    </div>
    <div style="margin-bottom:24px;">${bodyHtml}</div>
    <div id="aft-action" style="text-align:center;">
      <button id="btn-aft" class="btn primary" ${(rk === 'police' || rk === 'dj') ? 'disabled' : ''}>
        ${(rk === 'police' || rk === 'dj') ? t('chooseTarget') : t('confirm')}
      </button>
    </div>
  `, (el) => {
    const btnAft = el.querySelector('#btn-aft');
    let selectedTarget = null;

    if (rk === 'police' || rk === 'dj') {
      const items = el.querySelectorAll('.grid-item');
      items.forEach(item => {
        item.onclick = () => {
          items.forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          selectedTarget = item.dataset.id;
          btnAft.disabled = false;
          btnAft.textContent = t('confirm');
        };
      });
      btnAft.onclick = () => {
        if (!selectedTarget) return;
        socket.emit('afternoon-action', { targetId: selectedTarget });
        btnAft.disabled = true;
        btnAft.textContent = t('waiting');
      };
    } else {
      btnAft.onclick = () => {
        socket.emit('afternoon-skip');
        showWaiting(el);
      };
    }
  });
}

// ── Vote Phase ──
function renderVote() {
  state.phase = 'vote';
  const others = state.players.filter(p => p.id !== state.myId);
  const opts = others.map(p => `
    <div class="grid-item" data-id="${p.id}" data-name="${p.name}">
      <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
      <div class="player-name">${p.name}</div>
    </div>
  `).join('');

  render(`
    <div class="phase-banner" style="background:linear-gradient(135deg,#D32F2F,#C2185B);">
      <h2>${t('votePhase')}</h2>
      <p>${t('voteDesc')}</p>
    </div>
    <div class="player-grid">${opts}</div>
    <div style="text-align:center;">
      <button id="btn-vote" class="btn primary" disabled>${t('chooseTarget')}</button>
    </div>
  `, (el) => {
    const btnVote = el.querySelector('#btn-vote');
    let selectedId = null;
    const items = el.querySelectorAll('.grid-item');

    items.forEach(item => {
      item.onclick = () => {
        items.forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        selectedId = item.dataset.id;
        btnVote.disabled = false;
        btnVote.textContent = t('voteFor', { name: item.dataset.name });
      };
    });

    btnVote.onclick = () => {
      if (!selectedId) return;
      socket.emit('cast-vote', { targetId: selectedId });
      showWaiting(el);
    };
  });
}

// ── Vote Result ──
function renderVoteResult() {
  state.phase = 'vote-result';
  const d = state.voteResultData;
  if (!d) return;

  const elimText = d.eliminatedName
    ? t('eliminated', { name: d.eliminatedName })
    : t('noOneEliminated');

  // Build vote tally display
  const voteTally = {};
  if (d.votes) {
    Object.values(d.votes).forEach(targetId => {
      const target = state.players.find(p => p.id === targetId);
      const name = target ? target.name : '?';
      voteTally[name] = (voteTally[name] || 0) + 1;
    });
  }
  const tallyHtml = Object.entries(voteTally)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `
      <div class="player-item">
        <div class="player-avatar">${name.charAt(0).toUpperCase()}</div>
        <div class="player-info">
          <span class="player-name">${name}</span>
        </div>
        <div style="font-weight:800;font-size:1.5rem;color:var(--primary);">${count} ${t('votes')}</div>
      </div>
    `).join('');

  render(`
    <div style="text-align:center;margin-bottom:24px;padding:24px;background:rgba(0,0,0,0.04);border-radius:var(--radius-md);">
      <div style="font-size:3rem;">${d.eliminatedName ? '⚡' : '🤷'}</div>
      <h2>${elimText}</h2>
    </div>
    <h3 style="text-align:center;">${t('votes')}</h3>
    <ul class="player-list" style="margin-bottom:24px;">${tallyHtml}</ul>
    <button id="btn-show-result" class="btn primary">${t('result')}</button>
  `, (el) => {
    el.querySelector('#btn-show-result').onclick = () => {
      socket.emit('show-result');
    };
  });
}

// ── Final Result ──
function renderResult() {
  state.phase = 'result';
  const d = state.gameResultData;
  if (!d) return;

  let title = '';
  let titleClass = '';
  if (d.winner === 'village') { title = t('villageWins'); titleClass = 'village'; }
  else if (d.winner === 'werewolf') { title = t('werewolfWins'); titleClass = 'werewolf'; }
  else if (d.winner === 'ghost') { title = t('ghostWins'); titleClass = 'ghost'; }

  const cardsHtml = (d.players || []).map(p => {
    const pkKey = roleKey(p.playCard);
    const fkKey = roleKey(p.fieldCard);
    return `
      <div class="result-card-item">
        <div style="display:flex;align-items:center;">
          <div class="player-avatar" style="width:36px;height:36px;font-size:1rem;margin-right:12px;">${p.name.charAt(0).toUpperCase()}</div>
          <div style="font-weight:700;">${p.name}</div>
        </div>
        <div class="result-card-roles">
          <div style="text-align:center;">
            <div style="font-size:0.7rem;color:var(--text-light);">${t('playCard')}</div>
            <div class="role-tag role-${pkKey}">${ROLE_EMOJIS[pkKey]} ${tRole(pkKey)}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:0.7rem;color:var(--text-light);">${t('fieldCard')}</div>
            <div class="role-tag role-${fkKey}" style="opacity:0.7;">${ROLE_EMOJIS[fkKey]} ${tRole(fkKey)}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  render(`
    <div style="text-align:center;margin-bottom:16px;font-size:4rem;">🎉</div>
    <h2 class="result-winner ${titleClass}">${title}</h2>
    <div class="result-card-list">${cardsHtml}</div>
    ${state.isHost ? `<button id="btn-again" class="btn primary">${t('playAgain')}</button>` : ''}
    <button id="btn-home" class="btn ghost">${t('backToHome')}</button>
  `, (el) => {
    const btnAgain = el.querySelector('#btn-again');
    if (btnAgain) btnAgain.onclick = () => socket.emit('play-again');
    el.querySelector('#btn-home').onclick = () => {
      socket.emit('leave-room');
      state.roomCode = null;
      state.players = [];
      renderHome();
    };
  });
}

// ── Utility: show waiting spinner ──
function showWaiting(el) {
  const screen = el.querySelector('.screen.active') || el.closest('.screen');
  if (screen) {
    screen.innerHTML = `
      <div class="flex-center">
        <div style="font-size:3rem;" class="pulse">⏳</div>
        <h2>${t('waitingForOthers')}</h2>
      </div>`;
  }
}

// ══════════════════════════════════════════════
// SOCKET EVENT HANDLERS
// ══════════════════════════════════════════════

socket.on('connect', () => {
  state.myId = socket.id;
  if (!state.roomCode) renderHome();
});

socket.on('disconnect', () => showToast(t('disconnected')));

socket.on('error', (data) => {
  const msg = typeof data === 'string' ? data : (data?.message || 'Error');
  showToast(msg);
});

socket.on('room-created', (data) => {
  state.roomCode = data.roomCode;
  state.isHost = true;
  state.players = data.players || [];
  renderLobby();
});

socket.on('room-updated', (data) => {
  state.roomCode = data.roomCode || state.roomCode;
  state.players = data.players || [];
  // Update isHost
  const me = state.players.find(p => p.id === state.myId);
  if (me) state.isHost = me.isHost;
  // If phase is lobby (from server reset), go to lobby
  if (data.phase === 'lobby') {
    state.phase = 'lobby';
    renderLobby();
  } else if (state.phase === 'lobby' || state.phase === 'home') {
    renderLobby();
  }
});

socket.on('cards-dealt', (data) => {
  // Server sends { card1: 'Werewolf', card2: 'Villager' }
  state.card1 = data.card1;
  state.card2 = data.card2;
  state.myPlayCard = null;
  state.selectedIndex = null;
  renderCardSelect();
});

socket.on('phase-changed', (data) => {
  const phase = data.phase;

  if (phase === 'dawn') {
    // We need to know our play card for dawn rendering
    renderDawn();
  } else if (phase === 'day') {
    renderDay();
  } else if (phase === 'afternoon') {
    renderAfternoon();
  } else if (phase === 'vote') {
    renderVote();
  }
});

// Dawn result (fortune teller peek, or werewolf info)
socket.on('dawn-result', (data) => {
  state.dawnResultShown = true;
  const rk = roleKey(state.myPlayCard);

  if (rk === 'werewolf') {
    // data.targetRole is an array of fellow wolf names
    const wolves = Array.isArray(data.targetRole) ? data.targetRole : [];
    const infoEl = document.getElementById('wolf-info');
    if (infoEl) {
      infoEl.innerHTML = wolves.length > 0
        ? `<p style="font-weight:700;">${t('fellowWerewolves')}<br><span style="font-size:1.3rem;color:var(--secondary);">${wolves.join(', ')}</span></p>`
        : `<p style="font-weight:700;">${t('noFellowWerewolves')}</p>`;
    }
    const btnDawn = document.getElementById('btn-dawn');
    if (btnDawn) {
      btnDawn.disabled = false;
      btnDawn.textContent = t('confirm');
      btnDawn.onclick = () => {
        showWaiting(btnDawn.closest('.screen') || document.querySelector('.screen'));
      };
    }
  } else if (rk === 'fortuneTeller') {
    // data.targetRole is the server role name string
    const target = state.players.find(p => p.id === document.querySelector('.grid-item.selected')?.dataset?.id);
    const targetName = target ? target.name : '?';
    const peekRole = data.targetRole;
    const pk = roleKey(peekRole);

    const actionEl = document.getElementById('dawn-action');
    if (actionEl) {
      actionEl.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:4rem;margin:16px 0;">${ROLE_EMOJIS[pk]}</div>
          <p style="font-size:1.1rem;font-weight:700;">${t('peekResult', { name: targetName, role: tRole(pk) })}</p>
          <button id="btn-dawn-ok" class="btn primary" style="margin-top:16px;">${t('confirm')}</button>
        </div>
      `;
      document.getElementById('btn-dawn-ok').onclick = () => {
        showWaiting(document.querySelector('.screen'));
      };
    }
  } else if (rk === 'traitor') {
    // For traitor, we sent dawn-action but server returns werewolf names
    const wolves = Array.isArray(data.targetRole) ? data.targetRole : [];
    const infoEl = document.getElementById('traitor-info');
    if (infoEl) {
      infoEl.innerHTML = wolves.length > 0
        ? `<p style="font-weight:700;">${t('werewolvesAre')}<br><span style="font-size:1.3rem;color:var(--secondary);">${wolves.join(', ')}</span></p>`
        : `<p style="font-weight:700;">?</p>`;
    }
    const btnDawn = document.getElementById('btn-dawn');
    if (btnDawn) {
      btnDawn.disabled = false;
      btnDawn.textContent = t('confirm');
      btnDawn.onclick = () => {
        showWaiting(btnDawn.closest('.screen') || document.querySelector('.screen'));
      };
    }
  }
});

// Afternoon result (police peek / DJ swap)
socket.on('afternoon-result', (data) => {
  state.afternoonResultShown = true;
  const rk = roleKey(state.myPlayCard);
  const actionEl = document.getElementById('aft-action');

  if (rk === 'police') {
    // data.result is the field card role name
    const target = state.players.find(p => p.id === document.querySelector('.grid-item.selected')?.dataset?.id);
    const targetName = target ? target.name : '?';
    const fieldRole = data.result;
    const fk = roleKey(fieldRole);

    if (actionEl) {
      actionEl.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:4rem;margin:16px 0;">${ROLE_EMOJIS[fk]}</div>
          <p style="font-size:1.1rem;font-weight:700;">${t('fieldResult', { name: targetName, role: tRole(fk) })}</p>
          <button id="btn-aft-ok" class="btn primary" style="margin-top:16px;">${t('confirm')}</button>
        </div>
      `;
      document.getElementById('btn-aft-ok').onclick = () => {
        showWaiting(document.querySelector('.screen'));
      };
    }
  } else if (rk === 'dj') {
    // data.result is true (swap done)
    const target = state.players.find(p => p.id === document.querySelector('.grid-item.selected')?.dataset?.id);
    const targetName = target ? target.name : '?';

    if (actionEl) {
      actionEl.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:4rem;margin:16px 0;">🔄</div>
          <p style="font-size:1.1rem;font-weight:700;">${t('swapDone', { name: targetName })}</p>
          <button id="btn-aft-ok" class="btn primary" style="margin-top:16px;">${t('confirm')}</button>
        </div>
      `;
      document.getElementById('btn-aft-ok').onclick = () => {
        showWaiting(document.querySelector('.screen'));
      };
    }
  }
});

socket.on('vote-result', (data) => {
  state.voteResultData = data;
  renderVoteResult();
});

socket.on('game-result', (data) => {
  state.gameResultData = data;
  renderResult();
});

// ── Initial Render ──
renderHome();
