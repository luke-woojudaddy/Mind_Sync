import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// --- 전역 설정 및 소켓 초기화 ---
const SOCKET_URL = 'http://192.168.0.43:5050';
const socket = io(SOCKET_URL, {
  transports: ['websocket'],
  autoConnect: false,
});

// --- API 로직 통합 ---
const API_URL = 'http://192.168.0.43:5050';

const createRoom = async (name) => {
  const response = await fetch(`${API_URL}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error('방 생성 실패');
  return response.json();
};

const joinRoom = async (roomId) => {
  const response = await fetch(`${API_URL}/api/rooms/${roomId}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('방 입장 실패');
  return response.json();
};

const generateUserId = () => 'user_' + Math.random().toString(36).substr(2, 9);

// 게임 팁 리스트
const GAME_TIPS = [
    "이야기꾼은 너무 쉽지도, 너무 어렵지도 않게 단어를 선정해야 점수를 얻습니다!",
    "내 카드가 정답으로 오해받으면(낚시) 추가 점수를 얻을 수 있습니다.",
    "다른 사람의 심리를 파악해보세요. 평소 그 사람의 생각 패턴이 힌트가 됩니다.",
    "그림의 전체적인 분위기보다는 작은 디테일 하나가 결정적 힌트일 수 있습니다.",
    "이야기꾼이 되면 과감한 단어 선택보다는 공감할 수 있는 단어가 유리할 때도 있습니다.",
    "너무 뻔한 카드를 내면 낚시에 실패할 확률이 높습니다. 살짝 비틀어보세요!",
    "이야기꾼의 평소 관심사나 취미를 생각하면 정답이 보일지도 모릅니다.",
    "색감이 비슷한 카드는 혼란을 주기 좋습니다. 색깔을 활용해보세요.",
    "추상적인 단어일수록 그림의 느낌(몽환적, 어두움 등)에 집중하는 것이 좋습니다.",
    "속담이나 영화 제목, 노래 가사를 인용하면 더 재밌는 이야기가 됩니다.",
    "카드를 고를 때 너무 오래 고민하면 오히려 남들이 눈치챌 수 있습니다.",
    "내 카드가 정답 같아 보여도, 투표 때는 냉정하게 다른 카드를 살펴봐야 합니다.",
    "이야기꾼이 낸 단어가 '명사'인지 '형용사'인지 잘 생각해보세요.",
    "가끔은 아무런 관련 없어 보이는 카드가 정답일 때도 있습니다. (이야기꾼의 실수일 수도?)",
    "점수가 뒤처지고 있다면 과감한 낚시로 역전을 노려보세요!"
];

// 게임 룰 모달 컴포넌트
const RulesModal = ({ onClose }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="bg-gray-800 border border-white/20 p-6 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">📖 게임 규칙</h2>
            <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
                <div>
                    <h3 className="font-bold text-white mb-1">1. 이야기꾼의 턴</h3>
                    <p>이야기꾼은 자신의 카드 중 하나를 고르고, 그 카드와 어울리는 '단어'를 선택합니다.</p>
                </div>
                <div>
                    <h3 className="font-bold text-white mb-1">2. 다른 플레이어의 제출</h3>
                    <p>나머지 플레이어들은 이야기꾼이 제시한 단어를 보고, 자신의 패에서 가장 비슷하다고 생각되는 카드를 냅니다.</p>
                </div>
                <div>
                    <h3 className="font-bold text-white mb-1">3. 투표</h3>
                    <p>모든 카드가 섞여서 공개됩니다. 플레이어들은 이야기꾼이 낸 카드가 무엇인지 추측하여 투표합니다. (자기 카드 투표 불가)</p>
                </div>
                <div>
                    <h3 className="font-bold text-white mb-1">4. 점수 계산</h3>
                    <ul className="list-disc list-inside pl-2 space-y-1">
                        <li><strong>모두 정답/모두 오답:</strong> 이야기꾼 0점, 나머지 2점</li>
                        <li><strong>그 외:</strong> 이야기꾼 3점, 정답자 3점</li>
                        <li><strong>낚시 보너스:</strong> 이야기꾼이 아닌데 내 카드가 표를 받으면 표당 +1점</li>
                    </ul>
                </div>
            </div>
            <button onClick={onClose} className="mt-6 w-full py-3 bg-blue-600 rounded-xl font-bold hover:bg-blue-500 transition">닫기</button>
        </div>
    </div>
);

function App() {
  const [view, setView] = useState('lobby'); 
  const [roomId, setRoomId] = useState('');
  const [roomInput, setRoomInput] = useState('');
  
  const [users, setUsers] = useState([]);
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  
  const [roomState, setRoomState] = useState(null); 
  const [myHand, setMyHand] = useState([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [notification, setNotification] = useState(null);
  const [showRules, setShowRules] = useState(false);

  // [설정] 라운드 설정 및 애니메이션 방향 State
  const [roundsPerUser, setRoundsPerUser] = useState(2); 
  const [slideDirection, setSlideDirection] = useState(0); 

  // 결과 화면 딜레이 처리를 위한 state
  const [resultDelayCount, setResultDelayCount] = useState(0);
  const [resultMessage, setResultMessage] = useState(null); // 결과 화면 멘트
  const [currentTip, setCurrentTip] = useState(GAME_TIPS[0]); // 현재 보여줄 팁

  const prevPhaseRef = useRef(null);
  const [zoomCard, setZoomCard] = useState(null); 
  const [confirmedCard, setConfirmedCard] = useState(null); 
  const [selectedWord, setSelectedWord] = useState(null);
  
  const [mySubmitCount, setMySubmitCount] = useState(0);
  const [targetSubmitCount, setTargetSubmitCount] = useState(1);
  const [amISubmitted, setAmISubmitted] = useState(false);
  const [amIVoted, setAmIVoted] = useState(false);
  
  const [myVotedCardId, setMyVotedCardId] = useState(null);
  const [mySubmittedCards, setMySubmittedCards] = useState([]);

  // 터치 스와이프 처리를 위한 Ref
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);
  const minSwipeDistance = 50; // 스와이프 인식 최소 거리

  useEffect(() => {
    let storedId = sessionStorage.getItem('mind_sync_user_id');
    if (!storedId) {
      storedId = generateUserId();
      sessionStorage.setItem('mind_sync_user_id', storedId);
    }
    setMyId(storedId);

    const savedName = localStorage.getItem('mind_sync_username');
    if (savedName) {
        setMyName(savedName);
    } else {
        setMyName(`Player_${storedId.substr(-4)}`);
    }
    // 랜덤 팁 설정
    setCurrentTip(GAME_TIPS[Math.floor(Math.random() * GAME_TIPS.length)]);
  }, []);

  const updateLocalName = (name) => {
      setMyName(name);
      localStorage.setItem('mind_sync_username', name);
  };

  useEffect(() => {
    socket.on('update_user_list', (data) => {
      setUsers(data.users);
      const me = data.users.find(u => u.user_id === sessionStorage.getItem('mind_sync_user_id'));
      if (me) {
          if (me.hand) setMyHand(me.hand);
          setMySubmitCount(me.submitted_count || 0);
          setAmISubmitted(me.submitted || false);
          setAmIVoted(me.voted || false);
      }
    });

    socket.on('game_state_update', (data) => {
      setUsers(data.users);
      const currentPhase = data.room.phase;
      
      // 단계 변경 시 처리
      if (prevPhaseRef.current !== currentPhase) {
          if (currentPhase === 'storyteller_choosing') {
              setMySubmittedCards([]);
              setConfirmedCard(null);
              setSelectedWord(null);
              setZoomCard(null);
              setMyVotedCardId(null);
              setResultMessage(null); // 결과 멘트 초기화
              setCurrentTip(GAME_TIPS[Math.floor(Math.random() * GAME_TIPS.length)]); // 팁 변경
          }
          
          // 결과 화면 진입 시 10초 딜레이 설정
          if (currentPhase === 'result') {
              setResultDelayCount(10);
              determineResultMessage(data.room, data.users);
          }
      }
      
      setRoomState(data.room);
      prevPhaseRef.current = currentPhase;
      
      const me = data.users.find(u => u.user_id === sessionStorage.getItem('mind_sync_user_id'));
      if (me) {
          if (me.hand) setMyHand(me.hand);
          setMySubmitCount(me.submitted_count || 0);
          setAmISubmitted(me.submitted || false);
          setAmIVoted(me.voted || false);
      }
      if (data.room.audience_card_limit) {
          setTargetSubmitCount(data.room.audience_card_limit);
      }

      if (data.room.status === 'playing' && view !== 'game') {
        setView('game');
      }
    });

    socket.on('timer_update', (data) => setTimeLeft(data.time));

    socket.on('notification', (data) => {
        setNotification(data.message);
        setTimeout(() => setNotification(null), 3000);
    });

    return () => {
      socket.off('update_user_list');
      socket.off('game_state_update');
      socket.off('timer_update');
      socket.off('notification');
    };
  }, [view]);

  // 결과 화면 카운트다운 효과
  useEffect(() => {
      if (resultDelayCount > 0) {
          const timer = setTimeout(() => setResultDelayCount(resultDelayCount - 1), 1000);
          return () => clearTimeout(timer);
      }
  }, [resultDelayCount]);

  // 결과 멘트 결정 로직
  const determineResultMessage = (room, currentUsers) => {
      const me = currentUsers.find(u => u.user_id === myId);
      if (!me) return;

      const isStoryteller = room.storyteller_id === myId;
      const scoreGained = me.last_gained_score || 0;
      
      let message = "";
      
      if (isStoryteller) {
          if (scoreGained === 0) {
              message = "이런! 모두 맞추거나 모두 틀렸네요... 😅";
          } else {
              message = "나이스 스토리텔링! 성공입니다! 🎭";
          }
      } else {
          // 투표자
          const reason = me.last_score_reason || "";
          
          if (reason.includes("정답")) {
              message = "정답입니다! 훌륭한 눈썰미네요! 👁️";
          } else if (reason.includes("낚시")) {
              message = "월척입니다! 낚시 대성공! 🎣";
          } else if (scoreGained > 0) {
             message = "점수 획득 성공! 🎉";
          } else {
              message = "아쉽네요... 다음엔 맞출 수 있어요! 😢";
          }
      }
      setResultMessage(message);
  };

  // 게임 종료 시 멘트 결정 로직 (등수 기반)
  const getGameOverMessage = (sortedUsers) => {
      const myRankIndex = sortedUsers.findIndex(u => u.user_id === myId);
      if (myRankIndex === 0) return "🥇 우승을 축하합니다! 당신이 최고의 이야기꾼! 🎉";
      if (myRankIndex === sortedUsers.length - 1) return "꼴찌라니... 아쉽네요 😅 다음엔 더 잘할 수 있어요!";
      return "수고하셨습니다! 즐거운 게임 되셨나요? 😊";
  };

  // 방장 여부 확인
  const isHost = roomState?.host_id === myId;

  // 줌 네비게이션 함수
  const handleNextZoom = () => {
    if (!zoomCard) return;
    setSlideDirection(1); 
    const list = zoomCard.isVotingCandidate ? roomState.voting_candidates : myHand;
    const currentIndex = list.findIndex(c => (c.id || c.card_id) === (zoomCard.id || zoomCard.card_id));
    const nextIndex = (currentIndex + 1) % list.length;
    setZoomCard({ ...list[nextIndex], isVotingCandidate: zoomCard.isVotingCandidate });
  };

  const handlePrevZoom = () => {
    if (!zoomCard) return;
    setSlideDirection(-1); 
    const list = zoomCard.isVotingCandidate ? roomState.voting_candidates : myHand;
    const currentIndex = list.findIndex(c => (c.id || c.card_id) === (zoomCard.id || zoomCard.card_id));
    const prevIndex = (currentIndex - 1 + list.length) % list.length;
    setZoomCard({ ...list[prevIndex], isVotingCandidate: zoomCard.isVotingCandidate });
  };

  // 터치 이벤트 핸들러
  const onTouchStart = (e) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNextZoom();
    }
    if (isRightSwipe) {
      handlePrevZoom();
    }
  };

  const handleCreateRoom = async () => {
    try {
        const response = await createRoom('New Room');
        setRoomId(response.room.id);
        setView('waiting');
        setTimeout(() => enterGame(response.room.id), 100);
    } catch (e) { alert(e.message); }
  };
  
  const handleJoinRoom = async () => {
    if(!roomInput) return alert("방 번호를 입력해주세요!");
    try {
        await joinRoom(roomInput);
        setRoomId(roomInput);
        setView('waiting');
        setTimeout(() => enterGame(roomInput), 100);
    } catch (e) { alert("접속 오류: " + e.message); }
  };

  const enterGame = (rId) => {
    if (!socket.connected) socket.connect();
    socket.emit('join_game', { room_id: rId, user_id: myId, username: myName });
  };
  
  const handleUpdateProfile = () => {
    socket.emit('update_profile', { room_id: roomId, user_id: myId, username: myName });
    updateLocalName(myName); 
    alert("이름이 변경되었습니다!");
  };

  const handleStartGame = () => {
    if (users.length < 3) return; 
    socket.emit('start_game', { 
        room_id: roomId,
        rounds_per_user: roundsPerUser 
    });
  };

  const handleSubmitStory = () => {
    if (!confirmedCard || !selectedWord) return;
    socket.emit('submit_story', { room_id: roomId, card_id: confirmedCard.id, word: selectedWord });
    setConfirmedCard(null);
    setSelectedWord(null);
  };
  
  const handleRefreshWords = () => {
      if (roomState.reroll_count > 0) {
          socket.emit('refresh_words', { room_id: roomId, user_id: myId });
      }
  };

  const handleNextRound = () => {
      if (resultDelayCount > 0) return; // 딜레이 중 클릭 방지
      socket.emit('next_round', { room_id: roomId });
      setMyVotedCardId(null);
  };
  
  const handleBackToLobby = () => {
      setView('lobby');
      setRoomId('');
      setUsers([]);
      window.location.reload();
  };

  const isStoryteller = roomState?.storyteller_id === myId; 

  const handleCardClick = (card, isVotingCandidate = false) => {
    if (!isVotingCandidate && amISubmitted) return;
    setZoomCard({ ...card, isVotingCandidate });
  };

  const confirmCardSelection = () => {
    if (roomState.phase === 'storyteller_choosing') {
        if (isStoryteller) {
            setConfirmedCard(zoomCard);
            setZoomCard(null);
        }
    } else if (roomState.phase === 'audience_submitting') {
        if (!isStoryteller) {
            socket.emit('submit_card', {
                room_id: roomId,
                user_id: myId,
                card_id: zoomCard.id,
                card_src: zoomCard.src,
                username: myName
            });
            
            const newSubmitted = [...mySubmittedCards, zoomCard.id];
            setMySubmittedCards(newSubmitted);

            if (newSubmitted.length >= targetSubmitCount) {
                setZoomCard(null);
            }
        }
    } else if (roomState.phase === 'voting') {
        if (!isStoryteller && !amIVoted) {
             socket.emit('submit_vote', {
                 room_id: roomId,
                 user_id: myId,
                 card_id: zoomCard.card_id 
             });
             setMyVotedCardId(zoomCard.card_id);
             setZoomCard(null);
        }
    }
  };

  return (
    <div className="h-[100dvh] bg-gray-900 flex flex-col items-center justify-center text-white font-sans overflow-hidden relative">
      <style>{`
        @keyframes slideInRight { from { transform: translateX(50px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideInLeft { from { transform: translateX(-50px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-right { animation: slideInRight 0.3s ease-out forwards; }
        .animate-slide-left { animation: slideInLeft 0.3s ease-out forwards; }
      `}</style>

      {notification && (
          <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl z-[100] animate-bounce font-bold whitespace-nowrap">
              {notification}
          </div>
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {view === 'lobby' && (
         <div className="bg-white/10 p-8 rounded-2xl text-center w-full max-w-md">
            <h1 className="text-4xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-purple-400">Mind Sync</h1>
            <div className="mb-6 text-left">
                <label className="text-xs text-gray-400 ml-1">닉네임</label>
                <input value={myName} onChange={e=>updateLocalName(e.target.value)} className="w-full bg-black/40 border border-white/20 rounded-lg px-4 py-2 text-white text-center font-bold" />
            </div>
            <button onClick={handleCreateRoom} className="bg-gradient-to-r from-pink-600 to-purple-600 w-full py-4 rounded-xl font-bold mb-4 text-lg shadow-lg">방 만들기</button>
            <div className="flex gap-2">
                <input value={roomInput} onChange={e=>setRoomInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()} className="flex-1 bg-black/40 border border-white/20 rounded-xl px-4 text-white placeholder-gray-500" placeholder="방 번호" />
                <button onClick={handleJoinRoom} className="bg-white/10 border border-white/20 px-6 rounded-xl hover:bg-white/20">입장</button>
            </div>
         </div>
      )}

      {view === 'waiting' && (
          <div className="text-center w-full max-w-2xl px-4">
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 mb-8">
                <h2 className="text-gray-400 text-sm mb-2">ROOM ID</h2>
                <div className="text-5xl font-mono text-yellow-400 font-bold tracking-widest mb-6">{roomId}</div>
                <div className="flex justify-center gap-2 mb-8 max-w-xs mx-auto">
                    <input value={myName} onChange={(e) => setMyName(e.target.value)} className="bg-black/30 border border-white/20 rounded px-3 py-1 text-center text-white w-full" />
                    <button onClick={handleUpdateProfile} className="bg-blue-600 px-3 py-1 rounded text-sm whitespace-nowrap">변경</button>
                </div>
                {isHost && <div className="text-yellow-400 text-sm font-bold mb-2">👑 당신은 방장입니다</div>}
                <p className="text-xs text-gray-500 mb-6">⚠️ 게임 시작 후에는 이름을 변경할 수 없습니다.</p>
                <div className="flex justify-center gap-4 flex-wrap">
                    {users.map(u => (
                        <div key={u.user_id} className="flex flex-col items-center animate-fade-in-up">
                            <div className={`relative w-14 h-14 rounded-full flex items-center justify-center text-xl shadow-lg border-2 mb-2 ${u.user_id === myId ? 'bg-gradient-to-br from-purple-500 to-pink-500 border-white' : 'bg-gradient-to-br from-blue-500 to-cyan-400 border-white/20'}`}>
                                {u.username.substr(0,1)}
                                {u.user_id === roomState?.host_id && <div className="absolute -top-1 -right-1 bg-yellow-400 text-[10px] rounded-full w-5 h-5 flex items-center justify-center shadow-sm text-black">👑</div>}
                            </div>
                            <span className={`font-bold text-sm ${u.user_id === myId ? 'text-pink-300' : ''}`}>{u.username}</span>
                        </div>
                    ))}
                </div>
              </div>

              {isHost ? (
                  <>
                      <div className="mb-8 bg-white/5 p-4 rounded-xl border border-white/10 max-w-sm mx-auto">
                          <h3 className="text-gray-400 text-sm mb-3">인당 출제 횟수 (총 {users.length * roundsPerUser} 라운드)</h3>
                          <div className="flex items-center justify-center gap-6">
                              <button 
                                  onClick={() => setRoundsPerUser(Math.max(1, roundsPerUser - 1))}
                                  className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-xl font-bold transition"
                              >-</button>
                              <span className="text-3xl font-bold text-yellow-400 font-mono w-8">{roundsPerUser}</span>
                              <button 
                                  onClick={() => setRoundsPerUser(Math.min(5, roundsPerUser + 1))}
                                  className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-xl font-bold transition"
                              >+</button>
                          </div>
                      </div>

                      <button onClick={handleStartGame} disabled={users.length < 3} className={`font-bold py-4 px-12 rounded-full text-xl shadow-lg transition ${users.length >= 3 ? 'bg-green-600 hover:bg-green-500 text-white animate-pulse' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}>
                          {users.length < 3 ? `3명 필요 (${users.length}/3)` : '게임 시작 🎮'}
                      </button>
                  </>
              ) : (
                  <div className="text-center text-gray-400 animate-pulse mt-8">
                      방장이 게임 설정을 완료하고 시작하기를 기다리는 중... ⏳
                  </div>
              )}
          </div>
      )}

      {view === 'game' && roomState && (
        <div className="w-full max-w-7xl p-2 flex flex-col h-full relative z-0">
            <div className="flex-none flex items-center justify-between bg-black/60 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/10 z-30 shadow-lg gap-4">
                
                <div className="flex items-center gap-4 min-w-0 w-1/4">
                    <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-full border-2 ${timeLeft <= 10 ? 'border-red-500 text-red-500 bg-red-900/20' : 'border-white/20 bg-white/5'}`}>
                        <span className="text-[10px] text-gray-400 -mb-1">SEC</span>
                        <span className="text-xl font-bold font-mono">{timeLeft}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400">ROUND</span>
                        <span className="text-lg font-bold text-white leading-none">{roomState.current_round} <span className="text-gray-500 text-sm">/ {roomState.total_rounds}</span></span>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center flex-1">
                    {roomState.selected_word ? (
                         <div className="animate-fade-in-down">
                            <span className="text-[10px] text-yellow-500/80 mb-1 block text-center">제시어</span>
                            <div className="bg-gradient-to-r from-yellow-600 to-orange-600 border border-yellow-400 px-8 py-2 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.4)] text-center min-w-[150px]">
                                <span className="text-white font-extrabold text-xl sm:text-2xl drop-shadow-md tracking-wider">"{roomState.selected_word}"</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-500 text-sm italic">주제 선정 중...</div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 min-w-0 w-1/4">
                    <div className="flex -space-x-2">
                        {users.map(u => (
                            <div key={u.user_id} className="relative group">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all shadow-md
                                    ${u.user_id === roomState.storyteller_id ? 'border-yellow-400 bg-yellow-900/50 text-yellow-300 z-10' : 'border-gray-600 bg-gray-800 text-gray-400'} 
                                    ${u.user_id === myId ? 'ring-2 ring-pink-500 ring-offset-1 ring-offset-black' : ''}`}>
                                    {u.username.substr(0,1)}
                                </div>
                                {u.user_id === roomState.storyteller_id && <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full w-4 h-4 flex items-center justify-center text-[10px] shadow-sm border border-black z-20">📖</div>}
                                {(roomState.phase === 'voting' ? u.voted : u.submitted) && u.user_id !== roomState.storyteller_id && (
                                    <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] shadow-sm border border-black z-20">✓</div>
                                )}
                                <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50">
                                    {u.username} ({u.score}점)
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => setShowRules(true)} className="bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center border border-white/20 transition text-sm">❓</button>
                </div>
            </div>

            <div className="flex-1 w-full overflow-y-auto flex flex-col items-center relative py-2 scrollbar-hide">
                 {roomState.phase === 'storyteller_choosing' && (
                    <>
                        {isStoryteller && !confirmedCard && (
                            <div className="text-center mt-6">
                                <h3 className="text-xl font-bold text-white mb-2">어떤 이야기를 들려줄까요?</h3>
                                <p className="text-gray-400 text-sm">아래 덱에서 카드를 선택해주세요.</p>
                            </div>
                        )}
                        {/* [수정] 이야기꾼 단어 선택 레이아웃: 모바일/데스크톱 대응 개선 */}
                        {isStoryteller && confirmedCard && (
                             <div className="w-full h-fit flex flex-col md:flex-row items-center md:items-start justify-center gap-4 md:gap-8 px-4 max-w-7xl mx-auto pb-40">
                                {/* Left: Card Container */}
                                <div className="relative w-full max-w-[280px] sm:max-w-[320px] md:max-w-md flex-shrink-0 mt-4">
                                    <div className="relative group cursor-pointer" onClick={() => handleCardClick(confirmedCard)}>
                                        <img 
                                            src={confirmedCard.src} 
                                            className="w-full h-auto max-h-[35vh] md:max-h-[65vh] rounded-2xl shadow-[0_0_30px_rgba(236,72,153,0.3)] border-4 border-pink-500/50 object-contain bg-black/30 transition-transform duration-300" 
                                        />
                                        <button 
                                            onClick={(e) => {e.stopPropagation(); setConfirmedCard(null); setSelectedWord(null);}} 
                                            className="absolute -top-3 -right-3 bg-gray-800 text-white rounded-full p-2.5 border border-white/20 shadow-lg hover:bg-gray-700 transition z-10"
                                        >
                                            🔄
                                        </button>
                                    </div>
                                </div>

                                {/* Right: Word Selection & Action */}
                                <div className="flex flex-col items-center md:items-start w-full max-w-2xl">
                                    <div className="mb-4 text-center md:text-left">
                                        <h3 className="text-xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-300 mb-1">단어 선택</h3>
                                        <p className="text-gray-400 text-xs md:text-base">이미지와 어울리는 단어를 골라주세요.</p>
                                    </div>

                                    <div className="w-full bg-white/5 p-4 md:p-6 rounded-2xl border border-white/10 backdrop-blur-sm mb-4">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-xs md:text-sm text-gray-400 font-bold">제시어 목록</span>
                                            <button onClick={handleRefreshWords} disabled={roomState.reroll_count <= 0}
                                                className={`text-[10px] md:text-xs px-2 py-1 rounded-lg border flex items-center gap-1 transition font-bold
                                                    ${roomState.reroll_count > 0 ? 'bg-blue-600/20 border-blue-500/50 text-blue-300 hover:bg-blue-600/40' : 'bg-gray-700/50 border-gray-600 text-gray-500 cursor-not-allowed'}`}>
                                                🔄 변경 ({roomState.reroll_count})
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 md:gap-2">
                                            {roomState.word_candidates?.map((word) => (
                                                <button 
                                                    key={word} 
                                                    onClick={() => setSelectedWord(word)} 
                                                    className={`py-2 px-0.5 text-[11px] md:text-sm rounded-lg font-bold border transition-all duration-200 
                                                        ${selectedWord === word 
                                                            ? 'bg-gradient-to-br from-pink-600 to-purple-600 border-pink-400 text-white shadow-lg scale-105' 
                                                            : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/30'}`}
                                                >
                                                    {word}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button 
                                        onClick={handleSubmitStory} 
                                        disabled={!selectedWord}
                                        className={`w-full py-3.5 md:py-4 rounded-xl font-bold text-base md:text-lg shadow-xl transition-all duration-300
                                            ${selectedWord 
                                                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-[1.02] text-white shadow-green-500/20' 
                                                : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-white/5'}`}
                                    >
                                        {selectedWord ? `"${selectedWord}" (으)로 결정하기 ✅` : '단어를 선택해주세요'}
                                    </button>
                                </div>
                             </div>
                        )}
                        {!isStoryteller && <div className="text-center text-gray-400 mt-20"><div className="text-5xl mb-4 animate-bounce">🤔</div><p className="text-lg">이야기꾼이 고민 중입니다...</p></div>}
                    </>
                 )}

                 {roomState.phase === 'audience_submitting' && (
                    <div className="flex flex-col items-center justify-center w-full max-w-lg mt-10 px-4 animate-fade-in-up">
                        <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center shadow-xl relative overflow-hidden">
                             <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl"></div>
                             <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>

                             {!isStoryteller && !amISubmitted ? (
                                 <>
                                    <h2 className="text-2xl font-bold text-white mb-2 relative z-10">당신의 카드를 선택하세요!</h2>
                                    <p className="text-gray-400 text-sm mb-6 relative z-10">주제와 가장 잘 어울리는 이미지는?</p>
                                    {targetSubmitCount > 1 && (
                                        <div className="inline-block bg-pink-500/20 text-pink-300 px-4 py-1 rounded-full text-sm font-bold border border-pink-500/30 mb-4">
                                            {mySubmitCount} / {targetSubmitCount}장 제출됨
                                        </div>
                                    )}
                                    <div className="text-4xl animate-bounce relative z-10">👇</div>
                                 </>
                             ) : (
                                 <>
                                    <h2 className="text-2xl font-bold text-green-400 mb-2 relative z-10">제출 완료!</h2>
                                    <p className="text-gray-400 text-sm mb-6 relative z-10">다른 플레이어들이 고민 중입니다...</p>
                                    <div className="animate-spin text-4xl mb-2">⏳</div>
                                 </>
                             )}
                        </div>
                        <div className="mt-8 text-center max-w-sm">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 block">Game Tip</span>
                            <p className="text-gray-400 text-xs italic bg-black/30 px-4 py-2 rounded-lg border border-white/5">
                                💡 {currentTip}
                            </p>
                        </div>
                    </div>
                )}
                
                {roomState.phase === 'voting' && (
                    <div className="w-full flex flex-col items-center">
                        <div className="text-center mb-4">
                            <h2 className="text-xl font-bold text-white">{isStoryteller ? "👀 투표 진행 중" : amIVoted ? "✅ 투표 완료!" : "🤔 정답은?"}</h2>
                        </div>
                        {(!roomState.voting_candidates || roomState.voting_candidates.length === 0) ? (
                            <div className="text-gray-400 animate-pulse">카드 섞는 중...</div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 p-6 w-full">
                                {roomState.voting_candidates.map((card) => {
                                    const isMyVoted = amIVoted && card.card_id === myVotedCardId;
                                    return (
                                        <div key={card.card_id} onClick={() => handleCardClick(card, true)} 
                                            className={`relative aspect-[2/3] group cursor-pointer transition-all duration-300 
                                            ${amIVoted ? (isMyVoted ? 'scale-105 z-10 ring-4 ring-blue-500 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'opacity-40 grayscale pointer-events-none') : 'hover:scale-105'} 
                                            ${card.user_id === myId ? 'opacity-70 pointer-events-none' : ''}`}>
                                            <img src={card.card_src} className="w-full h-full rounded-xl shadow-2xl object-cover border border-white/20" />
                                            {card.user_id === myId && <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center"><span className="text-white font-bold border border-white/50 px-2 py-1 rounded text-xs">내 카드</span></div>}
                                            {isMyVoted && <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">내 투표 ✅</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {roomState.phase === 'result' && (
                    <div className="w-full h-full flex flex-col items-center animate-fade-in-up">
                        {resultMessage && (
                            <div className="mb-4 text-center animate-bounce-in">
                                <h3 className="text-xl md:text-2xl font-bold text-white drop-shadow-lg bg-black/40 px-6 py-2 rounded-full border border-white/20 backdrop-blur-sm">
                                    {resultMessage}
                                </h3>
                            </div>
                        )}

                        <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-4 drop-shadow-lg text-center">🏆 라운드 결과 🏆</h2>
                        <div className="flex flex-wrap justify-center gap-6 mb-6 w-full mt-4 px-2 overflow-visible">
                            {roomState.round_results?.map((res, idx) => (
                                <div key={idx} className={`relative flex flex-col items-center overflow-visible bg-white/5 p-3 rounded-2xl border border-white/10 ${res.is_storyteller ? 'order-first ring-2 ring-yellow-500/50 bg-yellow-500/5' : ''}`}>
                                    {res.is_storyteller && <div className="absolute -top-4 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full z-20 shadow-lg animate-bounce whitespace-nowrap">👑 정답 카드</div>}
                                    <div className={`w-32 h-48 rounded-lg overflow-hidden shadow-2xl border-2 bg-gray-900 mb-3 ${res.is_storyteller ? 'border-yellow-500 shadow-yellow-500/50' : 'border-gray-600'}`}>
                                        <img src={res.card_src} className="w-full h-full object-cover" alt="result" />
                                    </div>
                                    <div className="w-full flex items-center justify-center gap-1 mb-2">
                                        <span className="text-[10px] text-gray-400">🎨 제출:</span>
                                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${res.is_storyteller ? 'text-yellow-300' : 'text-white'}`}>{res.username}</span>
                                    </div>
                                    {res.voters && res.voters.length > 0 ? (
                                        <div className="w-full bg-black/30 rounded-lg p-2 flex flex-col items-center">
                                            <span className="text-[9px] text-gray-500 mb-1 block w-full text-center border-b border-white/10 pb-1">🗳️ 투표한 사람</span>
                                            <div className="flex gap-1 flex-wrap justify-center">
                                                {res.voters.map((voterName, vIdx) => <span key={vIdx} className="bg-blue-600/80 text-[10px] px-1.5 py-0.5 rounded-full text-white shadow-sm">{voterName}</span>)}
                                            </div>
                                        </div>
                                    ) : <div className="w-full text-center py-2 text-[10px] text-gray-600 italic">(득표 없음)</div>}
                                </div>
                            ))}
                        </div>
                         <div className="flex flex-col gap-2 mb-6 w-full max-w-2xl px-4">
                            {users.map(u => (
                                <div key={u.user_id} className={`flex justify-between items-center bg-black/40 px-4 py-2 rounded-xl border ${u.user_id === myId ? 'border-pink-500/50 bg-pink-900/20' : 'border-white/10'}`}>
                                    <div className="flex flex-col">
                                        <span className={`font-bold text-sm ${u.user_id === myId ? 'text-pink-300' : 'text-gray-300'}`}>{u.username} {u.user_id === myId && "(나)"}</span>
                                        <span className="text-[10px] text-gray-400 italic">{u.last_score_reason || "-"}</span>
                                    </div>
                                    <div className="flex items-end gap-1">
                                        <span className="text-lg font-bold">{u.score}</span>
                                        {u.last_gained_score > 0 && <span className="text-xs text-green-400 font-bold mb-1">(+{u.last_gained_score})</span>}
                                    </div>
                                </div>
                            ))}
                         </div>
                        
                        <button 
                            onClick={handleNextRound} 
                            disabled={resultDelayCount > 0}
                            className={`font-bold py-3 px-10 rounded-full text-lg shadow-lg transition mb-20 flex items-center gap-2
                                ${resultDelayCount > 0 
                                    ? 'bg-gray-600 text-gray-400 cursor-wait' 
                                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:scale-105'}`}
                        >
                            {resultDelayCount > 0 ? (
                                <>결과 확인 중... ({resultDelayCount})</>
                            ) : (
                                <>{roomState.current_round >= roomState.total_rounds ? "최종 결과 보기 🏆" : "다음 라운드 진행"}</>
                            )}
                        </button>
                    </div>
                )}
                
                {roomState.phase === 'game_over' && (
                    <div className="text-center animate-fade-in-up mt-10">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">{getGameOverMessage(users.sort((a, b) => b.score - a.score))}</h2>
                        </div>
                        <h1 className="text-4xl font-extrabold text-yellow-400 mb-6 drop-shadow-lg">🎉 게임 종료! 🎉</h1>
                        <div className="bg-black/50 p-6 rounded-2xl border border-white/20 mb-8 min-w-[300px]">
                             {users.sort((a, b) => b.score - a.score).map((u, idx) => (
                                <div key={u.user_id} className={`flex justify-between items-center py-3 border-b border-white/10 last:border-0 ${u.user_id === myId ? 'bg-white/5 px-2 rounded' : ''}`}>
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}</span>
                                        <span className={`font-bold text-lg ${idx === 0 ? 'text-yellow-300' : 'text-white'}`}>{u.username}</span>
                                    </div>
                                    <span className="text-yellow-300 font-mono text-xl font-bold">{u.score}점</span>
                                </div>
                           ))}
                        </div>
                        <button onClick={handleBackToLobby} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-10 rounded-full transition">로비로 돌아가기</button>
                    </div>
                )}
            </div>

            {/* 하단 패(카드 패) - 이야기꾼이 카드 확정한 단계에서는 숨김 */}
            {['storyteller_choosing', 'audience_submitting'].includes(roomState.phase) && !(isStoryteller && confirmedCard) && (
                <div className={`fixed bottom-0 left-0 w-full z-50 pointer-events-none transition-opacity duration-500 ${amISubmitted ? 'opacity-80' : 'opacity-100'}`}>
                    <div className="bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent pt-4 pb-4 px-2">
                        <div className="flex justify-center w-full">
                             <div className="flex gap-2 overflow-x-auto px-2 pb-2 h-32 items-end scrollbar-hide w-fit mx-auto max-w-full pointer-events-auto">
                                {myHand.map((card) => {
                                    const isSubmittedLocal = mySubmittedCards.includes(card.id);
                                    const isMyStoryCard = isStoryteller && roomState.storyteller_card_id === card.id;
                                    return (
                                        <div key={card.id} onClick={() => handleCardClick(card)} 
                                            className={`flex-none w-[90px] h-28 bg-gray-800 rounded-lg cursor-pointer hover:-translate-y-2 transition-transform shadow-lg border border-white/10 overflow-hidden relative group 
                                            ${confirmedCard?.id === card.id ? 'opacity-50 grayscale' : ''} 
                                            ${isSubmittedLocal ? 'opacity-40 border-green-500 border-2' : ''}
                                            ${isMyStoryCard ? 'ring-2 ring-yellow-500 opacity-70' : ''}`}>
                                            <img src={card.src} className="w-full h-full object-cover" />
                                            {isSubmittedLocal && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><span className="text-2xl font-bold">✅</span></div>}
                                            {isMyStoryCard && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60"><span className="text-xl">📖</span><span className="text-[8px] text-yellow-300 font-bold mt-1">제출함</span></div>}
                                            {card.is_new && <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-bl-lg shadow-md animate-pulse">NEW</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Zoom Modal */}
            {zoomCard && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md select-none touch-none" 
                    onClick={() => setZoomCard(null)}
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd} 
                >
                    <div className="relative w-full h-full flex items-center justify-center p-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        
                        {roomState.selected_word && (
                            <div className="absolute top-4 z-[130] animate-fade-in-down pointer-events-none">
                                <div className="bg-black/60 px-6 py-2 rounded-full border border-yellow-500/50 backdrop-blur-sm shadow-xl">
                                    <span className="text-gray-300 text-xs mr-2">주제어</span>
                                    <span className="text-yellow-400 font-extrabold text-xl tracking-wider">"{roomState.selected_word}"</span>
                                </div>
                            </div>
                        )}

                        <div className="relative w-full max-w-5xl h-full flex items-center justify-center pointer-events-none">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handlePrevZoom(); }} 
                                className="absolute left-0 sm:left-4 z-[120] p-4 bg-white/10 hover:bg-white/20 rounded-full text-3xl transition backdrop-blur-sm border border-white/10 pointer-events-auto" 
                            >
                                <span className="block transform scale-x-[-1]">➜</span>
                            </button>

                            <div className="relative w-full max-w-2xl flex items-center justify-center aspect-[2/3] max-h-[70vh] pointer-events-auto">
                                <img
                                    key={zoomCard.id || zoomCard.card_id} 
                                    src={zoomCard.src || zoomCard.card_src}
                                    className={`absolute w-full h-full object-contain rounded-xl shadow-2xl pointer-events-none ${slideDirection > 0 ? 'animate-slide-right' : slideDirection < 0 ? 'animate-slide-left' : ''}`}
                                />
                                {mySubmittedCards.includes(zoomCard.id) && !zoomCard.isVotingCandidate && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
                                        <div className="text-green-500 font-bold text-4xl border-4 border-green-500 rounded-full w-24 h-24 flex items-center justify-center animate-bounce">
                                            ✓
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={(e) => { e.stopPropagation(); handleNextZoom(); }} 
                                className="absolute right-0 sm:right-4 z-[120] p-4 bg-white/10 hover:bg-white/20 rounded-full text-3xl transition backdrop-blur-sm border border-white/10 pointer-events-auto" 
                            >
                                ➜
                            </button>
                        </div>

                        <div className="absolute bottom-10 z-[120] flex gap-4 pointer-events-auto">
                            <button onClick={() => setZoomCard(null)} className="px-6 py-3 rounded-full bg-gray-800/80 hover:bg-gray-700 border border-white/20 font-bold backdrop-blur-md transition">닫기</button>
                            {((isStoryteller && !confirmedCard && roomState.phase === 'storyteller_choosing' && !zoomCard.isVotingCandidate) ||
                                (!isStoryteller && !amISubmitted && roomState.phase === 'audience_submitting' && !zoomCard.isVotingCandidate && !mySubmittedCards.includes(zoomCard.id))) && (
                                <button onClick={confirmCardSelection} className="px-8 py-3 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:scale-105 font-bold shadow-xl transition">
                                    {isStoryteller ? '이 카드로 결정!' : (targetSubmitCount > 1 ? `제출 (${mySubmitCount + 1}/${targetSubmitCount})` : '이 카드로 제출!')}
                                </button>
                            )}
                            
                            {(!isStoryteller && roomState.phase === 'audience_submitting' && !zoomCard.isVotingCandidate && mySubmittedCards.includes(zoomCard.id)) && (
                                 <button disabled className="px-8 py-3 rounded-full bg-gray-600 text-gray-400 font-bold shadow-xl cursor-not-allowed border border-gray-500">
                                     제출 완료
                                 </button>
                            )}

                            {(!isStoryteller && !amIVoted && roomState.phase === 'voting' && zoomCard.isVotingCandidate && zoomCard.user_id !== myId) && (
                                 <button onClick={confirmCardSelection} className="px-8 py-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:scale-105 font-bold shadow-xl transition animate-pulse">🗳️ 정답 투표!</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}
    </div>
  );
}

export default App;