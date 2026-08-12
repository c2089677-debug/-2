const translations = {
  ja: {
    appTitle: '人狼どっち？',
    appSubtitle: 'オンライン人狼カードゲーム',
    createRoom: '部屋を作る',
    joinRoom: '部屋に入る',
    randomMatch: 'ランダムマッチで遊ぶ',
    yourName: 'あなたの名前',
    roomCode: '部屋コード',
    enterRoomCode: '4文字のコードを入力',
    waiting: '待機中...',
    players: 'プレイヤー',
    startGame: 'ゲーム開始！',
    needMorePlayers: 'あと{n}人必要',
    host: 'ホスト',
    you: 'あなた',
    chooseCard: '1枚を選んでください',
    card1: 'カード1',
    card2: 'カード2',
    selectedCard: '選択済み',
    waitingForOthers: '他のプレイヤーを待っています...',
    dawnPhase: '🌅 明け方',
    dawnDesc: '目を閉じてください。能力者が行動します。',
    dayPhase: '☀️ 昼間',
    dayDesc: '議論の時間です！誰が人狼か話し合いましょう。',
    afternoonPhase: '🌤️ 昼過ぎ',
    afternoonDesc: '能力者が行動します。',
    votePhase: '🗳️ 夕方 - 投票',
    voteDesc: '追放したい人に投票してください。',
    chooseTarget: '対象を選んでください',
    confirm: '決定',
    skip: 'スキップ',
    voteFor: '{name}に投票',
    result: '結果発表',
    eliminated: '{name}が追放されました',
    noOneEliminated: '投票が同数のため、誰も追放されませんでした',
    villageWins: '🎉 市民チームの勝利！',
    werewolfWins: '🐺 人狼チームの勝利！',
    ghostWins: '👻 おばけの単独勝利！',
    playAgain: 'もう一度遊ぶ',
    backToHome: 'ホームに戻る',
    copied: 'コピーしました！',
    shareCode: 'コードを共有',
    // Role names
    werewolf: '人狼',
    traitor: '裏切り者',
    villager: '市民',
    fortuneTeller: '占い師',
    police: '警察',
    dj: 'DJ',
    ghost: 'おばけ',
    // Role descriptions
    werewolfDesc: '仲間の人狼を確認できます',
    traitorDesc: '人狼チームとして勝利を目指します',
    villagerDesc: '議論で人狼を見つけましょう',
    fortuneTellerDesc: '1人のプレイカードを確認できます',
    policeDesc: '1人の場のカードを確認できます',
    djDesc: '1人のカードを入れ替えられます',
    ghostDesc: '追放されると単独勝利！',
    // Dawn phase
    youAreWerewolf: 'あなたは人狼です 🐺',
    fellowWerewolves: '仲間の人狼:',
    noFellowWerewolves: '仲間の人狼はいません（あなただけです）',
    youAreFortuneTeller: 'あなたは占い師です 🔮',
    choosePeekTarget: '誰のプレイカードを見ますか？',
    peekResult: '{name}のプレイカードは「{role}」です',
    youAreTraitor: 'あなたは裏切り者です 🗡️',
    werewolvesAre: '人狼は:',
    noAbility: '能力はありません。次のフェーズを待ってください。',
    // Afternoon phase
    youArePolice: 'あなたは警察です 🚔',
    chooseFieldTarget: '誰の場のカードを見ますか？',
    fieldResult: '{name}の場のカードは「{role}」です',
    youAreDJ: 'あなたはDJです 🎧',
    chooseSwapTarget: '誰のカードを入れ替えますか？',
    swapDone: '{name}のプレイカードと場のカードを入れ替えました',
    playCard: 'プレイカード',
    fieldCard: '場のカード',
    votes: '票',
    language: '言語',
    disconnected: '接続が切れました',
    reconnecting: '再接続中...',
  },
  en: {
    appTitle: 'Werewolf Which?',
    appSubtitle: 'Online Werewolf Card Game',
    createRoom: 'Create Room',
    joinRoom: 'Join Room',
    randomMatch: 'Play Random Match',
    yourName: 'Your Name',
    roomCode: 'Room Code',
    enterRoomCode: 'Enter 4-letter code',
    waiting: 'Waiting...',
    players: 'Players',
    startGame: 'Start Game!',
    needMorePlayers: 'Need {n} more player(s)',
    host: 'Host',
    you: 'You',
    chooseCard: 'Choose 1 card',
    card1: 'Card 1',
    card2: 'Card 2',
    selectedCard: 'Selected',
    waitingForOthers: 'Waiting for other players...',
    dawnPhase: '🌅 Dawn',
    dawnDesc: 'Close your eyes. Ability users take action.',
    dayPhase: '☀️ Day',
    dayDesc: 'Discuss! Who is the werewolf?',
    afternoonPhase: '🌤️ Afternoon',
    afternoonDesc: 'Ability users take action.',
    votePhase: '🗳️ Evening - Vote',
    voteDesc: 'Vote to eliminate a player.',
    chooseTarget: 'Choose a target',
    confirm: 'Confirm',
    skip: 'Skip',
    voteFor: 'Vote for {name}',
    result: 'Show Results',
    eliminated: '{name} was eliminated',
    noOneEliminated: 'No one was eliminated (tie vote)',
    villageWins: '🎉 Village Team Wins!',
    werewolfWins: '🐺 Werewolf Team Wins!',
    ghostWins: '👻 Ghost Solo Win!',
    playAgain: 'Play Again',
    backToHome: 'Back to Home',
    copied: 'Copied!',
    shareCode: 'Share this code',
    // Role names
    werewolf: 'Werewolf',
    traitor: 'Traitor',
    villager: 'Villager',
    fortuneTeller: 'Fortune Teller',
    police: 'Police',
    dj: 'DJ',
    ghost: 'Ghost',
    // Role descriptions
    werewolfDesc: 'See who your fellow werewolves are',
    traitorDesc: 'Fight for the werewolf team',
    villagerDesc: 'Find the werewolf through discussion',
    fortuneTellerDesc: 'Peek at one player\'s play card',
    policeDesc: 'Check one player\'s field card',
    djDesc: 'Swap one player\'s cards',
    ghostDesc: 'Win alone if you get eliminated!',
    // Dawn phase
    youAreWerewolf: 'You are a Werewolf 🐺',
    fellowWerewolves: 'Fellow werewolves:',
    noFellowWerewolves: 'No fellow werewolves (you\'re alone)',
    youAreFortuneTeller: 'You are the Fortune Teller 🔮',
    choosePeekTarget: 'Whose play card would you like to see?',
    peekResult: '{name}\'s play card is "{role}"',
    youAreTraitor: 'You are the Traitor 🗡️',
    werewolvesAre: 'Werewolves are:',
    noAbility: 'No special ability. Wait for the next phase.',
    // Afternoon phase
    youArePolice: 'You are the Police 🚔',
    chooseFieldTarget: 'Whose field card would you like to see?',
    fieldResult: '{name}\'s field card is "{role}"',
    youAreDJ: 'You are the DJ 🎧',
    chooseSwapTarget: 'Whose cards would you like to swap?',
    swapDone: 'Swapped {name}\'s play card and field card',
    playCard: 'Play Card',
    fieldCard: 'Field Card',
    votes: 'votes',
    language: 'Language',
    disconnected: 'Disconnected',
    reconnecting: 'Reconnecting...',
  }
};

let currentLang = localStorage.getItem('lang') || 'ja';

export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
}
export function getLang() { return currentLang; }

export function t(key, params) {
  const dict = translations[currentLang] || translations.ja;
  let str = dict[key] || translations.ja[key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}

export function tRole(key) {
  return t(key);
}

export function tRoleDesc(key) {
  return t(key + 'Desc') || '';
}
