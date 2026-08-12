import { io } from 'socket.io-client';
import { t, setLang, getLang, tRole, tRoleDesc } from './i18n.js';
import './style.css';

const socket = io();

// ── Role mapping: server names → i18n keys ──
const ROLE_MAP = {
  'Werewolf': 'werewolf', 'Traitor': 'traitor', 'Villager': 'villager',
  'Fortune Teller': 'fortuneTeller', 'Police': 'police', 'DJ': 'dj', 'Ghost': 'ghost'
};
const ROLE_EMOJIS = {
  werewolf: '🐺', traitor: '🗡️', villager: '👤',
  fortuneTeller: '🔮', police: '🚔', dj: '🎧', ghost: '👻'
};
const roleKey  = r => ROLE_MAP[r] || r;
const roleEmoji = r => ROLE_EMOJIS[roleKey(r)] || '❓';

// ── Game State ──
const state = {
  phase: 'title', roomCode: null, players: [], myId: null,
  isHost: false, myName: '', card1: null, card2: null,
  myPlayCard: null, selectionProgress: { selected: 0, total: 0 },
  endDiscVotes: 0, voteResultData: null, gameResultData: null,
  chatMessages: [], myVotedEndDisc: false,
  showingResult: false, pendingPhase: null, // Controls result overlay block
};

// ── Phase timers (client-side countdown) ──
let countdownInterval = null;
function startCountdown(seconds, onTick, onEnd) {
  if (countdownInterval) clearInterval(countdownInterval);
  let remaining = seconds;
  onTick(remaining);
  countdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      onEnd();
    } else {
      onTick(remaining);
    }
  }, 1000);
}
function stopCountdown() {
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
}

// ── DOM ──
const app = document.getElementById('app');
let langBtn = null;

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

function render(html, onMount, customClass = '') {
  stopCountdown();
  app.innerHTML = '';

  langBtn = document.createElement('button');
  langBtn.className = 'lang-toggle';
  langBtn.textContent = getLang() === 'ja' ? '🇬🇧 EN' : '🇯🇵 JA';
  langBtn.onclick = () => { setLang(getLang() === 'ja' ? 'en' : 'ja'); rerender(); };
  document.body.appendChild(langBtn);

  const screen = document.createElement('div');
  screen.className = `screen active ${customClass}`;
  screen.innerHTML = html;
  app.appendChild(screen);
  if (onMount) onMount(screen);
}

function rerender() { switchTo(state.phase); }

function switchTo(phase) {
  state.phase = phase;
  switch (phase) {
    case 'title':     renderTitle(); break;
    case 'home':      renderHome(); break;
    case 'lobby':     renderLobby(); break;
    case 'selecting': renderCardSelect(); break;
    case 'dawn':      renderDawn(); break;
    case 'day':       renderDay(); break;
    case 'afternoon': renderAfternoon(); break;
    case 'vote':      renderVote(); break;
    case 'vote-result': renderVoteResult(); break;
    case 'result':    renderResult(); break;
    default:          renderTitle();
  }
}

// ══════════════════════════════════════════════
// SCREENS
// ══════════════════════════════════════════════

function renderTitle() {
  state.phase = 'title';
  render(`
    <div class="title-logo-area">
      <h1>${t('appTitle')}</h1>
      <div class="title-subtitle">${t('appSubtitle')}</div>
    </div>
    <button id="btn-title-start" class="btn primary title-btn-start">
      ${t('pressStart')}
    </button>
  `, (el) => {
    el.querySelector('#btn-title-start').onclick = () => {
      switchTo('home');
    };
  }, 'screen-title');
}

// ══════════════════════════════════════════════
// SCREENS
// ══════════════════════════════════════════════

function renderHome() {
  state.phase = 'home';
  state.chatMessages = [];
  render(`
    <div class="flex-center">
      <span class="home-logo">🌕</span>
      <h1>${t('appTitle')}</h1>
      <p style="margin-bottom:32px;">${t('appSubtitle')}</p>

      <div class="input-group">
        <label>${t('yourName')}</label>
        <input type="text" id="inp-name" class="input" placeholder="Name" maxlength="10">
      </div>

      <button id="btn-random" class="btn gold">✨ ${t('randomMatch')}</button>
      <button id="btn-create" class="btn primary">🏠 ${t('createRoom')}</button>

      <div class="divider">OR</div>

      <div class="input-group">
        <label>${t('roomCode')}</label>
        <input type="text" id="inp-code" class="input" placeholder="${t('enterRoomCode')}"
          style="text-transform:uppercase;letter-spacing:6px;text-align:center;font-family:var(--font-title);font-size:1.3rem;" maxlength="4">
      </div>
      <button id="btn-join" class="btn accent">🚪 ${t('joinRoom')}</button>
    </div>
  `, (el) => {
    const nameInp = el.querySelector('#inp-name');
    const codeInp = el.querySelector('#inp-code');
    if (state.myName) nameInp.value = state.myName;

    el.querySelector('#btn-random').onclick = () => {
      const name = nameInp.value.trim();
      if (!name) { nameInp.classList.add('shake'); setTimeout(() => nameInp.classList.remove('shake'), 500); return; }
      state.myName = name;
      socket.emit('join-random-room', { playerName: name });
    };
    el.querySelector('#btn-create').onclick = () => {
      const name = nameInp.value.trim();
      if (!name) { nameInp.classList.add('shake'); setTimeout(() => nameInp.classList.remove('shake'), 500); return; }
      state.myName = name;
      socket.emit('create-room', { playerName: name });
    };
    el.querySelector('#btn-join').onclick = () => {
      const name = nameInp.value.trim();
      const code = codeInp.value.trim().toUpperCase();
      if (!name || code.length < 4) { showToast(t('enterRoomCode')); return; }
      state.myName = name;
      socket.emit('join-room', { roomCode: code, playerName: name });
    };
  });
}

// ── Lobby ──
function renderLobby() {
  state.phase = 'lobby';
  const playersHtml = state.players.map(p => `
    <li class="player-item fade-in">
      <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
      <div class="player-info">
        <span class="player-name">${p.name}${p.id === state.myId ? ` (${t('you')})` : ''}</span>
        ${p.isHost ? `<span class="player-badge">👑 ${t('host')}</span>` : ''}
      </div>
    </li>`).join('');
  const canStart = state.isHost && state.players.length >= 3;

  render(`
    <h2 style="margin-top:40px;">🐺 ${t('roomCode')}</h2>
    <div class="room-code-display" id="copy-code">
      <h2>${state.roomCode}</h2>
      <p>📋 ${t('shareCode')}</p>
    </div>
    <h3 style="text-align:center;color:var(--silver);font-size:0.85rem;margin-bottom:12px;">
      ${t('players')} ${state.players.length}/8
    </h3>
    <ul class="player-list">${playersHtml}</ul>
    ${state.isHost
      ? `<button id="btn-start" class="btn ${canStart ? 'primary' : 'ghost'}" ${canStart ? '' : 'disabled'}>
           ${canStart ? `⚔️ ${t('startGame')}` : `⏳ ${t('needMorePlayers', { n: Math.max(0, 3 - state.players.length) })}`}
         </button>`
      : `<div class="waiting-panel pulse"><h3>⏳</h3><p>${t('waitingForOthers')}</p></div>`
    }
    <button id="btn-leave" class="btn ghost">← ${t('backToHome')}</button>
  `, (el) => {
    el.querySelector('#copy-code').onclick = () => {
      navigator.clipboard?.writeText(state.roomCode);
      showToast(t('copied'));
    };
    el.querySelector('#btn-start')?.addEventListener('click', () => socket.emit('start-game'));
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
  render(`
    <div class="phase-banner phase-dawn" style="margin-top:40px;">
      <h2>🃏 ${t('chooseCard')}</h2>
    </div>
    <p>${t('chooseCard')}</p>
    <div class="card-container" id="cards-wrap"></div>
    <div id="confirm-wrap" style="display:none;">
      <p id="sel-label" style="font-weight:700;font-size:1.05rem;color:var(--gold);text-align:center;margin-bottom:12px;"></p>
      <button id="btn-confirm" class="btn primary">✅ ${t('confirm')}</button>
    </div>
    <div id="waiting-wrap" style="display:none;">
      <div class="waiting-panel">
        <h3>⏳ ${t('waitingForOthers')}</h3>
        <div class="progress-bar"><div class="progress-fill" id="sel-progress" style="width:0%"></div></div>
        <p id="sel-count" style="margin:0;font-size:0.9rem;"></p>
      </div>
    </div>
  `, (el) => {
    const wrap = el.querySelector('#cards-wrap');
    const confirmWrap = el.querySelector('#confirm-wrap');
    const waitingWrap = el.querySelector('#waiting-wrap');
    const selLabel = el.querySelector('#sel-label');
    const btnConfirm = el.querySelector('#btn-confirm');

    let viewed = [false, false], chosenIdx = null;

    [state.card1, state.card2].forEach((serverRole, idx) => {
      const key = roleKey(serverRole);
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-face card-back"></div>
        <div class="card-face card-front role-${key}">
          <div class="card-role-emoji">${ROLE_EMOJIS[key]}</div>
          <div class="card-role-name">${tRole(key)}</div>
          <div style="font-size:0.72rem;margin-top:8px;color:rgba(255,255,255,0.75);padding:0 4px;">${tRoleDesc(key)}</div>
        </div>`;
      card.onclick = () => {
        if (!viewed[idx]) { card.classList.add('flipped'); viewed[idx] = true; return; }
        if (!viewed[0] || !viewed[1]) { showToast(getLang() === 'ja' ? 'もう1枚も見てください' : 'View the other card first'); return; }
        wrap.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        chosenIdx = idx;
        confirmWrap.style.display = 'block';
        selLabel.textContent = `${roleEmoji(serverRole)} ${tRole(key)}`;
      };
      wrap.appendChild(card);
    });

    btnConfirm.onclick = () => {
      if (chosenIdx === null) return;
      state.myPlayCard = chosenIdx === 0 ? state.card1 : state.card2;
      socket.emit('select-card', { cardIndex: chosenIdx });
      confirmWrap.style.display = 'none';
      waitingWrap.style.display = 'block';
      updateSelProgress(el);
    };

    // Update progress immediately if already have data
    updateSelProgress(el);
  });
}

function updateSelProgress(rootEl) {
  const el = rootEl || document.querySelector('.screen.active');
  if (!el) return;
  const { selected, total } = state.selectionProgress;
  const pct = total > 0 ? (selected / total * 100) : 0;
  const fillEl = el.querySelector('#sel-progress');
  const countEl = el.querySelector('#sel-count');
  if (fillEl) fillEl.style.width = pct + '%';
  if (countEl) countEl.textContent = `${selected} / ${total}`;
}

// ── Dawn Phase ──
function renderDawn() {
  state.phase = 'dawn';
  const rk = roleKey(state.myPlayCard);
  const isActor = ['werewolf', 'fortuneTeller', 'traitor'].includes(rk);

  let roleSection = '';
  if (rk === 'fortuneTeller') {
    const opts = state.players.filter(p => p.id !== state.myId).map(p =>
      `<div class="grid-item" data-id="${p.id}">
        <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
        <div class="player-name">${p.name}</div>
      </div>`).join('');
    roleSection = `<h3 style="text-align:center;">${t('youAreFortuneTeller')}</h3>
      <p>${t('choosePeekTarget')}</p><div class="player-grid">${opts}</div>`;
  } else if (rk === 'werewolf') {
    roleSection = `<h3 style="text-align:center;">${t('youAreWerewolf')}</h3>
      <div id="wolf-info" class="info-box" style="text-align:center;">⏳ ${t('waiting')}</div>`;
  } else if (rk === 'traitor') {
    roleSection = `<h3 style="text-align:center;">${t('youAreTraitor')}</h3>
      <div id="traitor-info" class="info-box" style="text-align:center;">⏳ ${t('waiting')}</div>`;
  } else {
    roleSection = `<h3 style="text-align:center;">${roleEmoji(state.myPlayCard)} ${tRole(rk)}</h3>
      <p>${t('noAbility')}</p>`;
  }

  render(`
    <div class="phase-banner phase-dawn" style="margin-top:40px;">
      <h2>${t('dawnPhase')}</h2>
      <p>${t('dawnDesc')}</p>
    </div>
    ${isActor ? `
      <div style="text-align:center;margin-bottom:8px;">
        <div class="timer" id="dawn-timer">60</div>
        <div class="countdown-bar"><div class="countdown-fill" id="dawn-bar" style="width:100%"></div></div>
      </div>` : ''}
    <div style="margin-bottom:20px;">${roleSection}</div>
    <div id="dawn-action" style="text-align:center;">
      <button id="btn-dawn" class="btn primary" ${rk === 'fortuneTeller' ? 'disabled' : ''}>
        ${rk === 'fortuneTeller' ? `🔮 ${t('chooseTarget')}` : `✅ ${t('confirm')}`}
      </button>
    </div>
  `, (el) => {
    const btnDawn = el.querySelector('#btn-dawn');
    let selectedTarget = null;

    // Countdown for ability actors
    if (isActor) {
      startCountdown(60,
        (r) => {
          const timerEl = el.querySelector('#dawn-timer');
          const barEl = el.querySelector('#dawn-bar');
          if (timerEl) { timerEl.textContent = r; if (r <= 10) timerEl.classList.add('danger'); }
          if (barEl) barEl.style.width = (r / 60 * 100) + '%';
        },
        () => {} // server handles the abandon
      );
    }

    if (rk === 'werewolf') {
      socket.emit('dawn-action', { targetId: null });
    } else if (rk === 'traitor') {
      socket.emit('dawn-action', { targetId: null });
    } else if (rk === 'fortuneTeller') {
      el.querySelectorAll('.grid-item').forEach(item => {
        item.onclick = () => {
          el.querySelectorAll('.grid-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          selectedTarget = item.dataset.id;
          btnDawn.disabled = false;
          btnDawn.textContent = `✅ ${t('confirm')}`;
        };
      });
      btnDawn.onclick = () => {
        if (!selectedTarget) return;
        stopCountdown();
        socket.emit('dawn-action', { targetId: selectedTarget });
        btnDawn.disabled = true;
      };
    } else {
      btnDawn.onclick = () => {
        stopCountdown();
        socket.emit('dawn-skip');
        showWaitingInEl(el);
      };
    }
  });
}

// ── Day Phase (with chat + end-discussion voting) ──
function renderDay() {
  state.phase = 'day';
  state.myVotedEndDisc = false;
  state.endDiscVotes = 0;

  render(`
    <div class="phase-banner phase-day" style="margin-top:40px;">
      <h2>${t('dayPhase')}</h2>
      <p>${t('dayDesc')}</p>
    </div>
    <div class="timer" id="day-timer">03:00</div>

    <div class="chat-container" id="chat-box">
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-row">
        <input type="text" class="chat-input" id="chat-inp" placeholder="${getLang() === 'ja' ? 'メッセージを入力...' : 'Type a message...'}" maxlength="100">
        <button class="chat-send" id="chat-send">➤</button>
      </div>
    </div>

    <div class="end-disc-btn-wrap">
      <button id="btn-end-disc" class="btn danger">
        ⏭ End Discussion (0/3)
      </button>
    </div>
  `, (el) => {
    // Discussion timer
    let timeLeft = 180;
    const timerEl = el.querySelector('#day-timer');
    const dayTimerInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(dayTimerInterval);
        timerEl.textContent = '00:00';
        timerEl.classList.add('danger');
      } else {
        const m = String(Math.floor(timeLeft / 60)).padStart(2, '0');
        const s = String(timeLeft % 60).padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
        if (timeLeft <= 30) timerEl.classList.add('danger');
      }
    }, 1000);

    // Chat
    const chatMsgs = el.querySelector('#chat-messages');
    const chatInp = el.querySelector('#chat-inp');
    const chatSend = el.querySelector('#chat-send');

    // Render existing chat messages
    state.chatMessages.forEach(msg => appendChatMessage(chatMsgs, msg));
    scrollChat(chatMsgs);

    const sendChat = () => {
      const text = chatInp.value.trim();
      if (!text) return;
      socket.emit('chat-message', { text });
      chatInp.value = '';
    };
    chatSend.onclick = sendChat;
    chatInp.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

    // End discussion vote
    const btnEndDisc = el.querySelector('#btn-end-disc');
    btnEndDisc.onclick = () => {
      if (state.myVotedEndDisc) return;
      state.myVotedEndDisc = true;
      socket.emit('vote-end-discussion');
      btnEndDisc.disabled = true;
      btnEndDisc.textContent = `✅ Voted to end`;
    };

    // Listen for phase change to clear timer
    const phaseHandler = () => clearInterval(dayTimerInterval);
    socket.once('phase-changed', phaseHandler);
  });
}

function appendChatMessage(container, msg) {
  const isMe = msg.playerId === state.myId;
  const div = document.createElement('div');
  div.className = `chat-msg${isMe ? ' mine' : ''}`;
  div.innerHTML = `
    <div class="chat-avatar">${msg.playerName.charAt(0).toUpperCase()}</div>
    <div>
      ${!isMe ? `<div class="chat-name">${msg.playerName}</div>` : ''}
      <div class="chat-bubble">${escapeHtml(msg.text)}</div>
    </div>`;
  container.appendChild(div);
}
function scrollChat(el) { if (el) el.scrollTop = el.scrollHeight; }
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Afternoon Phase ──
function renderAfternoon() {
  state.phase = 'afternoon';
  const rk = roleKey(state.myPlayCard);
  const isActor = ['police', 'dj'].includes(rk);
  let roleSection = '';

  if (rk === 'police' || rk === 'dj') {
    const opts = state.players.filter(p => p.id !== state.myId).map(p =>
      `<div class="grid-item" data-id="${p.id}">
        <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
        <div class="player-name">${p.name}</div>
      </div>`).join('');
    roleSection = `
      <h3 style="text-align:center;">${rk === 'police' ? t('youArePolice') : t('youAreDJ')}</h3>
      <p>${rk === 'police' ? t('chooseFieldTarget') : t('chooseSwapTarget')}</p>
      <div class="player-grid">${opts}</div>`;
  } else {
    roleSection = `<h3 style="text-align:center;">${roleEmoji(state.myPlayCard)} ${tRole(rk)}</h3>
      <p>${t('noAbility')}</p>`;
  }

  render(`
    <div class="phase-banner phase-afternoon" style="margin-top:40px;">
      <h2>${t('afternoonPhase')}</h2>
      <p>${t('afternoonDesc')}</p>
    </div>
    ${isActor ? `
      <div style="text-align:center;margin-bottom:8px;">
        <div class="timer" id="aft-timer">60</div>
        <div class="countdown-bar"><div class="countdown-fill" id="aft-bar" style="width:100%"></div></div>
      </div>` : ''}
    <div style="margin-bottom:20px;">${roleSection}</div>
    <div id="aft-action" style="text-align:center;">
      <button id="btn-aft" class="btn primary" ${isActor ? 'disabled' : ''}>
        ${isActor ? `🎯 ${t('chooseTarget')}` : `✅ ${t('confirm')}`}
      </button>
    </div>
  `, (el) => {
    const btnAft = el.querySelector('#btn-aft');
    let selectedTarget = null;

    if (isActor) {
      startCountdown(60,
        (r) => {
          const timerEl = el.querySelector('#aft-timer');
          const barEl = el.querySelector('#aft-bar');
          if (timerEl) { timerEl.textContent = r; if (r <= 10) timerEl.classList.add('danger'); }
          if (barEl) barEl.style.width = (r / 60 * 100) + '%';
        },
        () => {}
      );

      el.querySelectorAll('.grid-item').forEach(item => {
        item.onclick = () => {
          el.querySelectorAll('.grid-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          selectedTarget = item.dataset.id;
          btnAft.disabled = false;
          btnAft.textContent = `✅ ${t('confirm')}`;
        };
      });
      btnAft.onclick = () => {
        if (!selectedTarget) return;
        stopCountdown();
        socket.emit('afternoon-action', { targetId: selectedTarget });
        btnAft.disabled = true;
      };
    } else {
      btnAft.onclick = () => {
        stopCountdown();
        socket.emit('afternoon-skip');
        showWaitingInEl(el);
      };
    }
  });
}

// ── Vote Phase ──
function renderVote() {
  state.phase = 'vote';
  const opts = state.players.filter(p => p.id !== state.myId).map(p =>
    `<div class="grid-item" data-id="${p.id}" data-name="${p.name}">
      <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
      <div class="player-name">${p.name}</div>
    </div>`).join('');

  render(`
    <div class="phase-banner phase-vote" style="margin-top:40px;">
      <h2>${t('votePhase')}</h2>
      <p>${t('voteDesc')}</p>
    </div>
    <div class="player-grid">${opts}</div>
    <div style="text-align:center;">
      <button id="btn-vote" class="btn primary" disabled>🗳️ ${t('chooseTarget')}</button>
    </div>
  `, (el) => {
    const btnVote = el.querySelector('#btn-vote');
    let selectedId = null;
    el.querySelectorAll('.grid-item').forEach(item => {
      item.onclick = () => {
        el.querySelectorAll('.grid-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        selectedId = item.dataset.id;
        btnVote.disabled = false;
        btnVote.textContent = `🗳️ ${t('voteFor', { name: item.dataset.name })}`;
      };
    });
    btnVote.onclick = () => {
      if (!selectedId) return;
      socket.emit('cast-vote', { targetId: selectedId });
      showWaitingInEl(el);
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

  const voteTally = {};
  if (d.votes) Object.values(d.votes).forEach(tid => {
    const p = state.players.find(p => p.id === tid);
    const n = p ? p.name : '?';
    voteTally[n] = (voteTally[n] || 0) + 1;
  });
  const tallyHtml = Object.entries(voteTally).sort((a,b) => b[1]-a[1]).map(([name, count]) => `
    <li class="player-item">
      <div class="player-avatar">${name.charAt(0).toUpperCase()}</div>
      <div class="player-info"><span class="player-name">${name}</span></div>
      <div style="font-weight:800;font-size:1.4rem;color:var(--crimson);">${count} ${t('votes')}</div>
    </li>`).join('');

  render(`
    <div style="text-align:center;margin:40px 0 24px;">
      <div style="font-size:4rem;" class="float">${d.eliminatedName ? '⚡' : '🤷'}</div>
      <h2>${elimText}</h2>
    </div>
    <h3 style="text-align:center;color:var(--silver);margin-bottom:12px;">🗳️ ${t('votes')}</h3>
    <ul class="player-list">${tallyHtml}</ul>
    <button id="btn-show-result" class="btn gold">📜 ${t('result')}</button>
  `, (el) => {
    el.querySelector('#btn-show-result').onclick = () => socket.emit('show-result');
  });
}

// ── Final Result ──
function renderResult() {
  state.phase = 'result';
  const d = state.gameResultData;
  if (!d) return;

  let title = '', titleClass = '';
  if (d.winner === 'village')  { title = t('villageWins');  titleClass = 'village'; }
  if (d.winner === 'werewolf') { title = t('werewolfWins'); titleClass = 'werewolf'; }
  if (d.winner === 'ghost')    { title = t('ghostWins');    titleClass = 'ghost'; }

  const cardsHtml = (d.players || []).map(p => {
    const pkKey = roleKey(p.playCard), fkKey = roleKey(p.fieldCard);
    return `
      <div class="result-card-item fade-in">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
          <span style="font-weight:700;">${p.name}</span>
        </div>
        <div class="result-card-roles">
          <div style="text-align:center;">
            <div style="font-size:0.65rem;color:var(--silver);margin-bottom:3px;">${t('playCard')}</div>
            <div class="role-tag role-${pkKey}">${ROLE_EMOJIS[pkKey]} ${tRole(pkKey)}</div>
          </div>
          <div style="text-align:center;opacity:0.7;">
            <div style="font-size:0.65rem;color:var(--silver);margin-bottom:3px;">${t('fieldCard')}</div>
            <div class="role-tag role-${fkKey}">${ROLE_EMOJIS[fkKey]} ${tRole(fkKey)}</div>
          </div>
        </div>
      </div>`;
  }).join('');

  render(`
    <div style="text-align:center;margin:40px 0 16px;">
      <div class="float" style="font-size:4rem;margin-bottom:8px;">${d.winner === 'village' ? '🎉' : d.winner === 'werewolf' ? '🐺' : '👻'}</div>
      <h2 class="result-winner ${titleClass}">${title}</h2>
    </div>
    <div class="result-card-list">${cardsHtml}</div>
    ${state.isHost ? `<button id="btn-again" class="btn primary">🔄 ${t('playAgain')}</button>` : ''}
    <button id="btn-home" class="btn ghost">← ${t('backToHome')}</button>
  `, (el) => {
    el.querySelector('#btn-again')?.addEventListener('click', () => socket.emit('play-again'));
    el.querySelector('#btn-home').onclick = () => {
      socket.emit('leave-room');
      state.roomCode = null; state.players = [];
      renderHome();
    };
  });
}

// ── Utility ──
function showWaitingInEl(el) {
  const screen = el.querySelector('.screen') || el;
  const existing = screen.querySelector('#waiting-wrap');
  if (existing) { existing.style.display = 'block'; return; }
  screen.innerHTML = `
    <div class="flex-center">
      <div class="float" style="font-size:4rem;">🌕</div>
      <h2>${t('waitingForOthers')}</h2>
      <p style="color:var(--silver);">...</p>
    </div>`;
}

// ══════════════════════════════════════════════
// SOCKET EVENT HANDLERS
// ══════════════════════════════════════════════

socket.on('connect', () => {
  state.myId = socket.id;
  if (!state.roomCode) renderHome();
});
socket.on('disconnect', () => showToast(t('disconnected')));
socket.on('error', (data) => showToast(typeof data === 'string' ? data : (data?.message || 'Error')));

socket.on('room-created', (data) => {
  state.roomCode = data.roomCode; state.isHost = true; state.players = data.players || [];
  renderLobby();
});
socket.on('room-updated', (data) => {
  state.roomCode = data.roomCode || state.roomCode;
  state.players = data.players || [];
  const me = state.players.find(p => p.id === state.myId);
  if (me) state.isHost = me.isHost;
  if (data.phase === 'lobby' || state.phase === 'lobby' || state.phase === 'home') renderLobby();
});

socket.on('cards-dealt', (data) => {
  state.card1 = data.card1; state.card2 = data.card2;
  state.myPlayCard = null; state.selectionProgress = { selected: 0, total: state.players.length };
  renderCardSelect();
});

socket.on('selection-progress', (data) => {
  state.selectionProgress = data;
  updateSelProgress();
});

function closeResult() {
  state.showingResult = false;
  if (state.pendingPhase) {
    const nextPhase = state.pendingPhase;
    state.pendingPhase = null;
    switchTo(nextPhase);
  } else {
    const screen = document.querySelector('.screen');
    if (screen) showWaitingInEl(screen);
  }
}

socket.on('phase-changed', (data) => {
  stopCountdown();
  if (state.showingResult) {
    state.pendingPhase = data.phase;
  } else {
    switchTo(data.phase);
  }
});

socket.on('dawn-result', (data) => {
  const rk = roleKey(state.myPlayCard);
  const screen = document.querySelector('.screen');
  if (!screen) return;

  state.showingResult = true;

  if (rk === 'werewolf') {
    const wolves = Array.isArray(data.targetRole) ? data.targetRole : [];
    const infoEl = screen.querySelector('#wolf-info');
    if (infoEl) {
      infoEl.innerHTML = wolves.length > 0
        ? `${t('fellowWerewolves')}<br><b style="color:var(--crimson);font-size:1.1rem;">${wolves.join(', ')}</b>`
        : `<span style="color:var(--silver);">${t('noFellowWerewolves')}</span>`;
    }
    const btn = screen.querySelector('#btn-dawn');
    if (btn) {
      stopCountdown();
      btn.disabled = false;
      btn.textContent = `✅ OK`;
      btn.onclick = () => {
        socket.emit('dawn-skip');
        closeResult();
      };
    }
  } else if (rk === 'fortuneTeller') {
    stopCountdown();
    const target = state.players.find(p => p.id === screen.querySelector('.grid-item.selected')?.dataset?.id);
    const targetName = target?.name || '?';
    const fk = roleKey(data.targetRole);
    const actionEl = screen.querySelector('#dawn-action');
    if (actionEl) {
      actionEl.innerHTML = `
        <div style="text-align:center;animation:fadeInUp 0.4s ease;">
          <div style="font-size:3.5rem;margin:12px 0;" class="float">${ROLE_EMOJIS[fk]}</div>
          <p style="font-size:1.05rem;font-weight:700;color:var(--gold);">${t('peekResult', { name: targetName, role: tRole(fk) })}</p>
          <button id="btn-ok" class="btn primary" style="margin-top:16px;">✅ OK</button>
        </div>`;
      screen.querySelector('#btn-ok').onclick = () => {
        closeResult();
      };
    }
  } else if (rk === 'traitor') {
    const wolves = Array.isArray(data.targetRole) ? data.targetRole : [];
    const infoEl = screen.querySelector('#traitor-info');
    if (infoEl) {
      infoEl.innerHTML = wolves.length > 0
        ? `${t('werewolvesAre')}<br><b style="color:var(--crimson);">${wolves.join(', ')}</b>`
        : `<span style="color:var(--silver);">—</span>`;
    }
    const btn = screen.querySelector('#btn-dawn');
    if (btn) {
      stopCountdown();
      btn.disabled = false;
      btn.textContent = `✅ OK`;
      btn.onclick = () => {
        socket.emit('dawn-skip');
        closeResult();
      };
    }
  }
});

socket.on('afternoon-result', (data) => {
  stopCountdown();
  const rk = roleKey(state.myPlayCard);
  const screen = document.querySelector('.screen');
  if (!screen) return;
  const actionEl = screen.querySelector('#aft-action');
  if (!actionEl) return;

  state.showingResult = true;

  const target = state.players.find(p => p.id === screen.querySelector('.grid-item.selected')?.dataset?.id);
  const targetName = target?.name || '?';

  if (rk === 'police') {
    const fk = roleKey(data.result);
    actionEl.innerHTML = `
      <div style="text-align:center;animation:fadeInUp 0.4s ease;">
        <div style="font-size:3.5rem;margin:12px 0;" class="float">${ROLE_EMOJIS[fk]}</div>
        <p style="font-size:1.05rem;font-weight:700;color:var(--gold);">${t('fieldResult', { name: targetName, role: tRole(fk) })}</p>
        <button id="btn-ok" class="btn primary" style="margin-top:16px;">✅ OK</button>
      </div>`;
  } else if (rk === 'dj') {
    actionEl.innerHTML = `
      <div style="text-align:center;animation:fadeInUp 0.4s ease;">
        <div style="font-size:3.5rem;margin:12px 0;" class="float">🔄</div>
        <p style="font-size:1.05rem;font-weight:700;color:var(--gold);">${t('swapDone', { name: targetName })}</p>
        <button id="btn-ok" class="btn primary" style="margin-top:16px;">✅ OK</button>
      </div>`;
  }
  screen.querySelector('#btn-ok')?.addEventListener('click', () => {
    closeResult();
  });
});

socket.on('chat-message', (data) => {
  state.chatMessages.push(data);
  if (state.phase !== 'day') return;
  const chatMsgs = document.querySelector('#chat-messages');
  if (!chatMsgs) return;
  appendChatMessage(chatMsgs, data);
  scrollChat(chatMsgs);
});

socket.on('end-discussion-votes', (data) => {
  state.endDiscVotes = data.count;
  const btn = document.querySelector('#btn-end-disc');
  if (btn && !state.myVotedEndDisc) {
    btn.textContent = `⏭ End Discussion (${data.count}/${data.needed})`;
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
socket.on('play-again', () => renderLobby());

socket.on('game-abandoned', () => {
  stopCountdown();
  showToast(getLang() === 'ja' ? '時間切れで試合が中断されました' : 'Match abandoned due to timeout');
  state.roomCode = null; state.players = [];
  renderHome();
});

// ── Boot ──
renderHome();
