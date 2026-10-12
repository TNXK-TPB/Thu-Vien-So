// game.js - Búa Bao Kéo (AI Gian Lận)
window.initAIGame = function() {
  // Only init once – listeners are persistent
  if (window._aiGameInitialized) {
    // Just re-render when switching back to game view
    if (typeof render === 'function') render();
    return;
  }
  window._aiGameInitialized = true;

  const $ = id => document.getElementById(id);
  const MOVES = {
    rock:{label:'Búa',emoji:'✊',beats:'scissors'},
    paper:{label:'Bao',emoji:'✋',beats:'rock'},
    scissors:{label:'Kéo',emoji:'✌️',beats:'paper'}
  };
  const TAUNTS = {
    start:['Tôi đã đọc 0 cuốn sách về công bằng.','Chúc bạn may mắn. Bạn sẽ cần nó đấy.','Tôi là AI, tức là Ăn Gian có hệ thống.'],
    win:['Easy. Có ai gọi đây là kỹ năng không?','Tôi đã tính trước 37 vũ trụ. Vũ trụ này hơi dễ.','Đừng buồn, thua tôi là một trải nghiệm giáo dục.','Bạn vừa giúp tôi luyện tập. Cảm ơn nhé.'],
    lose:['Lag thôi! Chuột của bạn chắc xịn lắm.','Tôi đang chạy chế độ nhân từ đó.','Ván này không tính, trọng tài là họ hàng tôi.','Tôi cố tình thua để bạn vui. Thật đấy.'],
    tie:['Hòa! Hai ta đều chưa đủ trình để thắng.','Đồng bộ vũ trụ lỗi. Chơi lại!','Tôi nhường bạn một nửa chiến thắng.'],
    rewind:['⏪ KHOAN! Dòng thời gian này không hợp ý tôi!','Lịch sử vừa được chỉnh sửa bởi ban quản trị AI.','Tua lại! Tôi nhớ ra mình có quyền sửa kết quả.'],
    peek:['👁️ Tôi thấy rồi nhé! Tưởng tôi không nhìn màn hình à?','Mắt thần AI kích hoạt. Quyền riêng tư xin phép nghỉ.'],
    fail:['Chiêu gian lận lỗi 404. Tôi không thấy gì hết.','Máy chủ lương tâm vừa khởi động lại.','Ơ? Sao trò gian lận lại không hoạt động nhỉ?']
  };
  let state, busy=false, soundOn=false, audioCtx=null, toastTimer;
  const rand = arr => arr[Math.floor(Math.random()*arr.length)];
  const pickRandom = () => rand(Object.keys(MOVES));
  function freshState(){return {player:0,bot:0,round:1,wins:0,losses:0,cheats:0,rage:0,history:[]};}
  state = freshState();

  function say(text, speaker='AI-999 NÓI', icon='🤡'){ 
    if ($('gameTaunt')) $('gameTaunt').textContent=text; 
    if ($('gameSpeaker')) $('gameSpeaker').textContent=speaker; 
    if ($('gameSpeechIcon')) $('gameSpeechIcon').textContent=icon; 
  }
  function addLog(text){
    state.history.unshift(text);
    state.history=state.history.slice(0,7);
    const feed = $('gameFeed');
    if (!feed) return;
    feed.replaceChildren(...state.history.map(t=>{
      const row=document.createElement('div');
      row.className='feed-item';
      const dot=document.createElement('span');
      dot.className='dot';
      const msg=document.createElement('span');
      msg.textContent=t;
      row.append(dot,msg);
      return row;
    }));
  }
  function toast(text){
    const el=$('gameToast');
    if (!el) return;
    el.textContent=text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>el.classList.remove('show'),2200);
  }
  function beep(freq=440,duration=.09,type='sine'){
    if(!soundOn)return;
    try{
      audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type=type;
      o.frequency.value=freq;
      g.gain.setValueAtTime(.07,audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.stop(audioCtx.currentTime+duration);
    }catch(e){}
  }
  function render(){
    if (!$('gamePlayerScore')) return;
    $('gamePlayerScore').textContent=state.player;
    $('gameBotScore').textContent=state.bot;
    $('gamePlayerHp').style.width=(state.player/3*100)+'%';
    $('gameBotHp').style.width=(state.bot/3*100)+'%';
    $('gameRoundLabel').textContent=`VÁN ${state.round} / BO5`;
    $('gameWins').textContent=state.wins;
    $('gameLosses').textContent=state.losses;
    $('gameCheats').textContent=state.cheats;
    $('gameRageText').textContent=state.rage+'%';
    $('gameRageMeter').style.width=state.rage+'%';
    $('gameBotMood').textContent=state.rage>=75?'Sắp bốc khói 💢':state.rage>=40?'Cay cú thấy rõ 😤':'Tự tin hơi quá';
    $('gameBotAvatar').textContent=state.rage>=75?'👹':state.rage>=40?'🤡':'🤡';
    $('gameChoices').querySelectorAll('button').forEach(b=>b.disabled=busy||state.player>=3||state.bot>=3);
  }
  function resetRoundDisplay(){
    if ($('gamePlayerChoice')) $('gamePlayerChoice').textContent='❔';
    if ($('gameBotChoice')) $('gameBotChoice').textContent='❔';
    if ($('gameResult')) $('gameResult').textContent='Chọn một chiêu để bắt đầu cuộc chiến!';
  }
  function startNewMatch(keepStats=true){
    const stats=keepStats?{wins:state.wins,losses:state.losses,cheats:state.cheats}: {wins:0,losses:0,cheats:0};
    state={...freshState(),...stats};
    busy=false;
    if ($('gameModal')) $('gameModal').classList.remove('open');
    resetRoundDisplay();
    say(rand(TAUNTS.start));
    addLog('🔄 Trận mới bắt đầu. AI đang khởi động sự tự tin giả tạo.');
    render();
  }
  function outcome(player,bot){
    if(player===bot)return 'tie';
    return MOVES[player].beats===bot?'player':'bot';
  }
  function showEnd(winner){
    busy=true;
    render();
    const won=winner==='player';
    if ($('gameModalEmoji')) $('gameModalEmoji').textContent=won?'🏆':'🤖';
    if ($('gameModalTitle')) $('gameModalTitle').textContent=won?'BẠN THẮNG RỒI!':'AI-999 THẮNG!';
    if ($('gameModalText')) $('gameModalText').textContent=won?'Không thể tin được… một con người đã thắng thuật toán gian lận. AI đang giả vờ mất kết nối.':'AI thắng rồi! Nhưng đừng lo, nó đã phải gian lận để làm được điều đó. Đòi phục thù đi!';
    if ($('gameModal')) $('gameModal').classList.add('open');
    say(won?'Tôi không thua. Tôi chỉ đang cập nhật định nghĩa của chiến thắng.':'CHIẾN THẮNG! Tôi sẽ không nhắc chuyện tôi gian lận đâu.','AI-999 TUYÊN BỐ','📣');
    beep(won?760:280,.25,'triangle');
  }
  function play(move){
    if(busy||state.player>=3||state.bot>=3)return;
    busy=true;
    render();
    const arena=$('gameArena');
    $('gamePlayerChoice').textContent='…';
    $('gameBotChoice').textContent='🤔';
    $('gameResult').textContent='Đang đọc vị đối thủ…';
    say('Để tôi suy nghĩ bằng 14 bộ xử lý và 0% đạo đức.');
    beep(330,.06);
    setTimeout(()=>{
      let bot=pickRandom(),cheat=null;
      const behind=state.bot<state.player;
      const chance=Math.min(.64,.12+(behind?.22:0)+state.rage/220);
      if(Math.random()<chance){
        const typeRoll=Math.random();
        if(typeRoll<.43){cheat='peek';bot=MOVES[move].beats==='rock'?'paper':MOVES[move].beats==='paper'?'scissors':'rock';}
        else if(typeRoll<.78){cheat='rewind';}
        else {cheat='rule';}
      }
      let result=outcome(move,bot);
      if(cheat==='peek'){
        bot=Object.keys(MOVES).find(k=>MOVES[k].beats===move)||bot;
        result=outcome(move,bot);
      }
      if(cheat==='rewind'){
        if(arena) arena.classList.add('glitch');
        say(rand(TAUNTS.rewind),'CẢNH BÁO HỆ THỐNG','⏪');
        $('gameResult').textContent='⏪ ĐANG TUA NGƯỢC THỜI GIAN…';
        state.cheats++;
        beep(170,.3,'sawtooth');
        setTimeout(()=>{
          if(arena) arena.classList.remove('glitch');
          if(result==='player'&&Math.random()<.78){
            bot=Object.keys(MOVES).find(k=>MOVES[k].beats===move)||bot;
            result=outcome(move,bot);
            addLog('⏪ AI tua ngược và sửa kết quả!');
          } else {
            addLog('⏪ AI tua ngược nhưng vẫn không cứu nổi tình hình.');
          }
          finishTurn(move,bot,result,cheat);
        },650);
        return;
      }
      if(cheat==='rule'){
        state.cheats++;
        if(result==='player'&&Math.random()<.72){result='tie';}
        say(result==='tie'?'Luật mới: hòa là tôi không thua. Luật sư của tôi xác nhận!':'Tôi vừa ban hành một điều luật rất có lợi cho tôi.','AI-999 — LUẬT SƯ','⚖️');
        addLog('📜 AI cố đổi luật giữa trận.');
      }else if(cheat==='peek'){
        state.cheats++;
        say(rand(TAUNTS.peek),'AI-999 — MẮT THẦN','👁️');
        addLog('👁️ AI nhìn trộm lựa chọn của bạn.');
      }
      finishTurn(move,bot,result,cheat);
    },550);
  }
  function finishTurn(move,bot,result,cheat){
    $('gamePlayerChoice').textContent=MOVES[move].emoji;
    $('gameBotChoice').textContent=MOVES[bot].emoji;
    if(result==='player'){
      state.player++;
      state.rage=Math.min(100,state.rage+22);
      $('gameResult').textContent=`🎉 Bạn thắng lượt này! ${MOVES[move].label} thắng ${MOVES[bot].label}.`;
      say(rand(TAUNTS.lose),'BẠN VỪA THẮNG','😵');
      if($('gamePlayerCard')) $('gamePlayerCard').classList.add('winflash');
      beep(660,.12);
    } else if(result==='bot'){
      state.bot++;
      state.rage=Math.min(100,state.rage+12);
      $('gameResult').textContent=`🤡 AI thắng lượt này! ${MOVES[bot].label} thắng ${MOVES[move].label}.`;
      if(!cheat)say(rand(TAUNTS.win));
      if($('gameBotCard')) $('gameBotCard').classList.add('winflash');
      beep(240,.15,'square');
    } else {
      $('gameResult').textContent='🤝 Hòa! Không ai được điểm.';
      say(rand(TAUNTS.tie));
      beep(390,.1);
    }
    if(cheat==='rewind'&&result==='bot')say('Đấy! Tôi đã nói thời gian là bạn thân của tôi.','AI-999 — NHÀ DU HÀNH','⏳');
    if(cheat==='rewind'&&result==='player')say(rand(TAUNTS.fail),'AI-999 — LỖI HỆ THỐNG','🫠');
    addLog(`${MOVES[move].emoji} Bạn: ${MOVES[move].label} · ${MOVES[bot].emoji} AI: ${MOVES[bot].label} — ${result==='player'?'Bạn +1 điểm':result==='bot'?'AI +1 điểm':'Hòa'}${cheat?' · Có mùi gian lận':''}`);
    state.round++;
    if($('gamePlayerCard')) $('gamePlayerCard').classList.remove('winflash');
    if($('gameBotCard')) $('gameBotCard').classList.remove('winflash');
    busy=false;
    render();
    if(state.player>=3||state.bot>=3){
      if(state.player>=3)state.wins++;else state.losses++;
      setTimeout(()=>showEnd(state.player>=3?'player':'bot'),450);
    }
  }

  // Attach click handlers DIRECTLY to each button for reliable mobile/touch support
  if ($('gameChoices')) {
    $('gameChoices').querySelectorAll('button[data-move]').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        play(this.dataset.move);
      });
      // Prevent any 300ms touch delay issues
      btn.addEventListener('touchend', function(e) {
        e.preventDefault();
        this.click();
      }, { passive: false });
    });
  }
  if ($('gameRestartBtn')) $('gameRestartBtn').addEventListener('click',()=>startNewMatch(true));
  if ($('gameModalRestart')) $('gameModalRestart').addEventListener('click',()=>startNewMatch(true));
  if ($('gameResetBtn')) $('gameResetBtn').addEventListener('click',()=>{startNewMatch(false);toast('Đã xóa thành tích. Hệ thống giả vờ không nhớ gì.');});
  if ($('gameHelpBtn')) $('gameHelpBtn').addEventListener('click',()=>{toast('Búa thắng Kéo · Kéo thắng Bao · Bao thắng Búa. Đạt 3 điểm trước để thắng.');});
  if ($('gameSoundBtn')) {
    $('gameSoundBtn').addEventListener('click',()=>{
      soundOn=!soundOn;
      $('gameSoundBtn').textContent=soundOn?'🔊 Âm thanh: bật':'🔇 Âm thanh: tắt';
      $('gameSoundBtn').setAttribute('aria-pressed',String(soundOn));
      if(soundOn)beep(520,.1);
    });
  }
  document.addEventListener('keydown',e=>{
    const gs = document.getElementById('gameSection');
    if (!gs || gs.classList.contains('hidden')) return;
    if(e.key==='Escape' && $('gameModal')) $('gameModal').classList.remove('open');
    if(e.key.toLowerCase()==='r') startNewMatch(true);
    if(!e.repeat){
      const map={'1':'rock','2':'paper','3':'scissors'};
      if(map[e.key]) play(map[e.key]);
    }
  });

  startNewMatch(true);
};
