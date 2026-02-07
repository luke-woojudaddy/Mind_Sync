import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

// ==================================================================
// [환경 변수 설정 - 수정됨]
// 안전장치(try-catch, typeof process)를 제거했습니다.
// 리액트 빌드 시스템(Webpack)은 'process.env.REACT_APP_API_URL'이라는 텍스트를 발견하면
// 빌드 시점에 실제 값(예: "http://localhost:5050")으로 문자열 치환을 수행합니다.
// ==================================================================
const SERVER_URL = process.env.REACT_APP_API_URL || 'https://api.lumiverselab.com';

// [디버깅] 현재 연결하려는 서버 주소를 브라우저 콘솔(F12)에 출력
console.log(`🔌 Connecting to Server: ${SERVER_URL}`);

// [속도 개선 1] WebSocket 강제 사용으로 초기 연결 딜레이 제거
const socket = io(SERVER_URL, {
    transports: ['websocket'],
    autoConnect: false,
});

// --- API 로직 통합 ---
const createRoom = async (name) => {
    const response = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('방 생성 실패');
    return response.json();
};

const joinRoom = async (roomId) => {
    const response = await fetch(`${SERVER_URL}/api/rooms/${roomId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('방 입장 실패');
    return response.json();
};

const generateUserId = () => 'user_' + Math.random().toString(36).substr(2, 9);

// 게임 팁 리스트 (기존 유지)
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in" onClick={onClose}>
        <div className="bg-gray-900/90 border border-white/10 p-8 rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition">✕</button>
            <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-6">📖 게임 규칙</h2>
            <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
                <div className="bg-white/5 p-4 rounded-xl">
                    <h3 className="font-bold text-white text-lg mb-2 flex items-center gap-2">🃏 1. 이야기꾼의 턴</h3>
                    <p className="text-gray-400">이야기꾼은 자신의 카드 중 하나를 고르고, 그 카드와 어울리는 <span className="text-yellow-400 font-bold">'단어'</span>를 선택합니다.</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl">
                    <h3 className="font-bold text-white text-lg mb-2 flex items-center gap-2">🗳️ 2. 다른 플레이어의 제출</h3>
                    <p className="text-gray-400">나머지 플레이어들은 이야기꾼이 제시한 단어를 보고, 자신의 패에서 가장 비슷하다고 생각되는 카드를 냅니다.</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl">
                    <h3 className="font-bold text-white text-lg mb-2 flex items-center gap-2">🔍 3. 투표</h3>
                    <p className="text-gray-400">모든 카드가 섞여서 공개됩니다. 플레이어들은 이야기꾼이 낸 카드가 무엇인지 추측하여 투표합니다. (자기 카드 투표 불가)</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl">
                    <h3 className="font-bold text-white text-lg mb-2 flex items-center gap-2">🏆 4. 점수 계산</h3>
                    <ul className="list-disc list-inside pl-2 space-y-1 text-gray-400">
                        <li><strong className="text-white">모두 정답/모두 오답:</strong> 이야기꾼 0점, 나머지 2점</li>
                        <li><strong className="text-white">그 외:</strong> 이야기꾼 3점, 정답자 3점</li>
                        <li><strong className="text-white">낚시 보너스:</strong> 내 카드가 표를 받으면 표당 +1점</li>
                    </ul>
                </div>
            </div>
            <button onClick={onClose} className="mt-8 w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl font-bold text-white hover:opacity-90 transition shadow-lg transform active:scale-95">알겠어요!</button>
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
    const [resultMessage, setResultMessage] = useState(null);
    const [currentTip, setCurrentTip] = useState(GAME_TIPS[0]);

    // [속도 개선 2] 로딩 상태 추가
    const [isLoading, setIsLoading] = useState(false);

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
    const minSwipeDistance = 50;

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
        setCurrentTip(GAME_TIPS[Math.floor(Math.random() * GAME_TIPS.length)]);

        // [새로고침 방지] 세션 스토리지에서 방 ID 확인 및 자동 재접속
        const storedRoomId = sessionStorage.getItem('mind_sync_room_id');
        if (storedRoomId) {
            setRoomId(storedRoomId);
            rejoinRoom(storedRoomId, storedId, savedName || `Player_${storedId.substr(-4)}`);
        }

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
            setIsLoading(false); // [속도 개선] 데이터 수신 시 로딩 해제
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
                    setResultMessage(null);
                    setCurrentTip(GAME_TIPS[Math.floor(Math.random() * GAME_TIPS.length)]);
                }

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

            // [중요] 게임 중이라면 view 강제 전환
            if (view !== 'game' && data.room.status === 'playing') {
                setView('game');
            } else if (view === 'lobby' && data.room.status === 'waiting') {
                // 로비에서 대기실로 복구
                setView('waiting');
            }
        });

        socket.on('timer_update', (data) => setTimeLeft(data.time));

        socket.on('notification', (data) => {
            setNotification(data.message);
            setTimeout(() => setNotification(null), 3000);
        });

        socket.on('error', (data) => {
            setView('lobby');
        });

        socket.on('kicked', (data) => {
            if (data.target_id === sessionStorage.getItem('mind_sync_user_id')) {
                alert("방장에 의해 강퇴되었습니다.");
                sessionStorage.removeItem('mind_sync_room_id');
                window.location.reload();
            }
        });

        return () => {
            socket.off('update_user_list');
            socket.off('game_state_update');
            socket.off('timer_update');
            socket.off('notification');
            socket.off('error');
            socket.off('kicked');
        };
    }, [view]);

    useEffect(() => {
        if (resultDelayCount > 0) {
            const timer = setTimeout(() => setResultDelayCount(resultDelayCount - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resultDelayCount]);

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

    const getGameOverMessage = (sortedUsers) => {
        const myRankIndex = sortedUsers.findIndex(u => u.user_id === myId);
        if (myRankIndex === 0) return "🥇 우승을 축하합니다! 당신이 최고의 이야기꾼! 🎉";
        if (myRankIndex === sortedUsers.length - 1) return "꼴찌라니... 아쉽네요 😅 다음엔 더 잘할 수 있어요!";
        return "수고하셨습니다! 즐거운 게임 되셨나요? 😊";
    };

    const isHost = roomState?.host_id === myId;

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

    const enterGame = (rId) => {
        if (!socket.connected) socket.connect();
        // [새로고침 방지] 세션 스토리지 저장
        sessionStorage.setItem('mind_sync_room_id', rId);
        socket.emit('join_game', { room_id: rId, user_id: myId, username: myName });
    };

    // [새로고침 방지] 재접속 전용 함수
    const rejoinRoom = (rId, uId, uName) => {
        setIsLoading(true);
        if (!socket.connected) socket.connect();
        socket.emit('join_game', { room_id: rId, user_id: uId, username: uName });
        // 뷰 상태는 서버 응답(game_state_update)에서 처리됨
    };

    const handleCreateRoom = async () => {
        if (isLoading) return;
        setIsLoading(true); // 로딩 시작
        try {
            const response = await createRoom(`${myName}'s Room`); // 임시 방 이름
            setRoomId(response.room.id);
            setView('waiting');
            enterGame(response.room.id);
        } catch (e) {
            alert(e.message);
            setIsLoading(false);
        }
    };

    const handleJoinRoom = async () => {
        if (!roomInput) return alert("방 번호를 입력해주세요!");
        if (isLoading) return;
        setIsLoading(true); // 로딩 시작
        try {
            await joinRoom(roomInput);
            setRoomId(roomInput);
            setView('waiting');
            enterGame(roomInput);
        } catch (e) {
            alert("접속 오류: " + e.message);
            setIsLoading(false);
        }
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
        if (resultDelayCount > 0) return;
        socket.emit('next_round', { room_id: roomId });
        setMyVotedCardId(null);
    };

    const handleKickUser = (targetId) => {
        if (!window.confirm("정말 이 사용자를 강퇴하시겠습니까?")) return;
        socket.emit('kick_user', { room_id: roomId, user_id: myId, target_user_id: targetId });
    };

    const handleBackToLobby = () => {
        // [새로고침 방지] 세션 스토리지 삭제
        sessionStorage.removeItem('mind_sync_room_id');
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
        <div className="h-[100dvh] md:h-[100dvh] bg-[#0a0a1a] flex flex-col items-center justify-center text-white font-sans overflow-x-hidden overflow-y-auto md:overflow-hidden relative selection:bg-pink-500 selection:text-white pb-[calc(env(safe-area-inset-bottom,20px)+60px)] md:pb-0 touch-pan-y scroll-smooth">
            {/* Background Animation & Effects */}
            <style>{`
        @keyframes blob-bounce { 
          0%, 100% { transform: translate(0, 0) scale(1); } 
          25% { transform: translate(20px, -20px) scale(1.1); }
          50% { transform: translate(-15px, 15px) scale(0.9); }
          75% { transform: translate(15px, 20px) scale(1.05); }
        }
        @keyframes aurora {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
        
        /* [중요] 누락된 애니메이션 키프레임 추가 */
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bounceIn { 0% { opacity: 0; transform: scale(0.3); } 50% { opacity: 1; transform: scale(1.05); } 70% { transform: scale(0.9); } 100% { transform: scale(1); } }
        @keyframes pulseFast { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }

        .animate-blob { animation: blob-bounce 20s infinite ease-in-out alternate; }
        .delay-2000 { animation-delay: 2s; }
        .delay-4000 { animation-delay: 4s; }
        .bg-aurora {
            background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
            background-size: 400% 400%;
            animation: aurora 15s ease infinite;
        }
        .glass-card {
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        /* [중요] 커스텀 애니메이션 클래스 정의 */
        .animate-fade-in-up { animation: fadeInUp 0.6s ease-out forwards; }
        .animate-fade-in-down { animation: fadeInDown 0.6s ease-out forwards; }
        .animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
        .animate-bounce-in { animation: bounceIn 0.8s cubic-bezier(0.215, 0.610, 0.355, 1.000) both; }
        .animate-pulse-fast { animation: pulseFast 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

        @keyframes slideInRight { from { transform: translateX(50px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideInLeft { from { transform: translateX(-50px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-right { animation: slideInRight 0.3s ease-out forwards; }
        .animate-slide-left { animation: slideInLeft 0.3s ease-out forwards; }
      `}</style>

            {/* Background Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[100px] animate-blob mix-blend-screen pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/30 rounded-full blur-[100px] animate-blob delay-2000 mix-blend-screen pointer-events-none"></div>
            <div className="absolute top-[40%] left-[40%] w-[300px] h-[300px] bg-pink-500/20 rounded-full blur-[80px] animate-blob delay-4000 mix-blend-screen pointer-events-none"></div>

            {/* [속도 개선] 로딩 오버레이 */}
            {isLoading && (
                <div className="absolute inset-0 bg-black/80 z-[200] flex flex-col items-center justify-center backdrop-blur-md">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-purple-200">SYNC</div>
                    </div>
                    <p className="text-purple-300 font-bold mt-4 animate-pulse tracking-widest text-sm">CONNECTING...</p>
                </div>
            )}

            {notification && (
                <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-red-600 to-pink-600 text-white px-8 py-3 rounded-full shadow-2xl z-[100] animate-bounce font-bold whitespace-nowrap border border-white/20">
                    {notification}
                </div>
            )}

            {showRules && <RulesModal onClose={() => setShowRules(false)} />}

            {view === 'lobby' && (
                <div className="relative z-10 glass-card p-10 rounded-[3rem] text-center w-full max-w-[420px] shadow-2xl animate-fade-in-up">
                    <div className="mb-8">
                        <h1 className="text-5xl font-extrabold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-300 tracking-tighter drop-shadow-sm">
                            Mind Sync
                        </h1>
                        <p className="text-xs text-gray-400 tracking-[0.2em] font-light uppercase">Connect Your Thoughts</p>
                    </div>

                    <div className="space-y-6">
                        <div className="text-left group">
                            <label className="text-xs text-indigo-200 ml-2 font-bold uppercase tracking-wider mb-1 block group-focus-within:text-pink-300 transition-colors">Nickname</label>
                            <input
                                value={myName}
                                onChange={e => updateLocalName(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-2xl px-5 py-4 text-white text-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:bg-black/50 transition-all placeholder-gray-600 shadow-inner"
                                placeholder="당신의 이름은?"
                            />
                        </div>

                        {/* OR Divider 제거됨 */}

                        <button
                            onClick={handleCreateRoom}
                            disabled={isLoading}
                            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-[1px] shadow-lg transition-transform active:scale-95"
                        >
                            <div className="relative bg-black/20 backdrop-blur-sm transition-colors group-hover:bg-white/10 w-full h-full rounded-2xl py-4">
                                <span className="relative font-bold text-lg text-white tracking-wide">✨ 새로운 방 만들기</span>
                            </div>
                        </button>

                        {/* OR Divider 이동됨 */}
                        <div className="relative py-2">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-transparent px-2 text-xs text-gray-500 font-mono">OR</span>
                            </div>
                        </div>

                        <div className="flex gap-2 h-14">
                            <input
                                value={roomInput}
                                onChange={e => setRoomInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                placeholder="Room ID"
                            />
                            <button
                                onClick={handleJoinRoom}
                                disabled={isLoading}
                                className="bg-white/10 border border-white/10 px-6 rounded-2xl hover:bg-white/20 hover:border-white/30 transition-all font-bold text-gray-300 disabled:opacity-50 active:scale-95"
                            >
                                입장
                            </button>
                        </div>
                    </div>

                    <p className="mt-8 text-[10px] text-gray-600">
                        v1.2.0 • Powered by Lumiverse Lab
                    </p>
                </div>
            )}

            {/* ... 나머지 부분은 기존과 동일 ... */}
            {view === 'waiting' && (
                <div className="text-center w-full max-w-4xl px-4 z-10">
                    <div className="glass-card p-8 rounded-[2.5rem] mb-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500"></div>

                        <h2 className="text-gray-400 text-xs font-bold tracking-[0.3em] mb-2 uppercase">Room Access Code</h2>
                        <div className="relative inline-block group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                            <div className="relative text-7xl font-mono text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-400 font-extrabold tracking-widest mb-6 drop-shadow-sm p-2">
                                {roomId}
                            </div>
                        </div>

                        <div className="flex justify-center items-center gap-3 mb-10 max-w-xs mx-auto bg-black/30 p-2 rounded-2xl border border-white/5">
                            <input
                                value={myName}
                                onChange={(e) => setMyName(e.target.value)}
                                className="bg-transparent border-none text-center text-white w-full focus:outline-none font-bold text-lg"
                            />
                            <button onClick={handleUpdateProfile} className="bg-blue-600/80 hover:bg-blue-500 px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition shadow-lg">이름 변경</button>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-center">
                            {users.map(u => (
                                <div key={u.user_id} className="flex flex-col items-center animate-fade-in-up group">
                                    <div className={`relative w-20 h-20 rounded-3xl flex items-center justify-center text-3xl shadow-xl border border-white/10 mb-3 transition-transform group-hover:scale-110 group-hover:-translate-y-2
                                ${u.user_id === myId
                                            ? 'bg-gradient-to-br from-pink-500/80 to-purple-600/80 ring-4 ring-pink-500/20'
                                            : 'bg-gradient-to-br from-gray-700/50 to-gray-800/50'}`}>
                                        <span className="drop-shadow-md">{u.username.substr(0, 1)}</span>
                                        {u.user_id === roomState?.host_id && <div className="absolute -top-2 -right-2 bg-yellow-400 text-[10px] rounded-full w-6 h-6 flex items-center justify-center shadow-lg text-black border-2 border-gray-900 z-10">👑</div>}
                                        {isHost && u.user_id !== myId && (
                                            <button
                                                onClick={() => handleKickUser(u.user_id)}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] rounded-full w-6 h-6 flex items-center justify-center shadow-lg border-2 border-gray-900 z-20 hover:bg-red-600 transition"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                    <span className={`font-bold text-sm px-3 py-1 rounded-full ${u.user_id === myId ? 'bg-pink-500/20 text-pink-200 border border-pink-500/30' : 'text-gray-400'}`}>
                                        {u.username}
                                    </span>
                                </div>
                            ))}

                            {/* Add AI Button (Host Only) */}
                            {roomState?.host_id === myId && users.length < 6 && (
                                <div
                                    className="flex flex-col items-center justify-center opacity-70 hover:opacity-100 cursor-pointer transition-opacity group"
                                    onClick={() => socket.emit('add_ai', { room_id: roomId, user_id: myId })}
                                >
                                    <div className="w-20 h-20 rounded-3xl border-2 border-dashed border-purple-400 flex items-center justify-center mb-3 bg-purple-500/10 group-hover:bg-purple-500/20 shadow-lg backdrop-blur-sm">
                                        <span className="text-3xl text-purple-300 font-bold">+</span>
                                    </div>
                                    <span className="text-purple-300 font-bold text-xs bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">Add AI</span>
                                </div>
                            )}

                            {/* Empty Slots Placeholder */}
                            {[...Array(Math.max(0, 3 - users.length - (roomState?.host_id === myId ? 1 : 0)))].map((_, i) => (
                                <div key={`empty-${i}`} className="flex flex-col items-center opacity-30">
                                    <div className="w-20 h-20 rounded-3xl border-2 border-dashed border-gray-500 flex items-center justify-center mb-3">
                                        <span className="text-2xl text-gray-600">+</span>
                                    </div>
                                    <span className="text-xs text-gray-600">Waiting...</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {isHost ? (
                        <div className="animate-fade-in-up delay-100">
                            <div className="mb-8 glass-card p-6 rounded-3xl max-w-sm mx-auto flex flex-col items-center">
                                <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">Game Settings</h3>
                                <div className="flex items-center justify-between w-full bg-black/20 rounded-2xl p-2">
                                    <button
                                        onClick={() => setRoundsPerUser(Math.max(1, roundsPerUser - 1))}
                                        className="w-12 h-12 rounded-xl bg-gray-700/50 hover:bg-gray-600 text-xl font-bold transition text-white"
                                    >-</button>
                                    <div className="flex flex-col items-center">
                                        <span className="text-2xl font-bold text-white font-mono">{roundsPerUser}</span>
                                        <span className="text-[10px] text-gray-500">인당 라운드</span>
                                    </div>
                                    <button
                                        onClick={() => setRoundsPerUser(Math.min(5, roundsPerUser + 1))}
                                        className="w-12 h-12 rounded-xl bg-gray-700/50 hover:bg-gray-600 text-xl font-bold transition text-white"
                                    >+</button>
                                </div>
                                <p className="text-gray-500 text-xs mt-3">총 {users.length * roundsPerUser} 라운드가 진행됩니다.</p>
                            </div>

                            <button
                                onClick={handleStartGame}
                                disabled={users.length < 3}
                                className={`w-full max-w-md py-5 rounded-2xl text-xl font-black tracking-widest shadow-2xl transition-all transform hover:-translate-y-1
                            ${users.length >= 3
                                        ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 text-white hover:shadow-green-500/30'
                                        : 'bg-gray-800 text-gray-600 cursor-not-allowed border border-white/5'}`}
                            >
                                {users.length < 3 ? `WAITING FOR PLAYERS (${users.length}/3)` : 'GAME START 🚀'}
                            </button>
                        </div>
                    ) : (
                        <div className="glass-card px-8 py-6 rounded-2xl inline-block mt-4">
                            <div className="flex items-center gap-4">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-ping"></div>
                                <span className="text-gray-300 font-bold animate-pulse">호스트가 게임을 설정하고 있습니다...</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {view === 'game' && roomState && (
                <div className="w-full max-w-7xl p-2 flex flex-col h-full relative z-0">
                    <div className="flex-none flex items-center justify-between bg-black/40 px-6 py-3 rounded-full backdrop-blur-xl border border-white/10 z-30 shadow-2xl gap-4 mx-2 mt-2">

                        <div className="flex items-center gap-4 min-w-0 w-1/4">
                            <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-full border-[3px] shadow-inner ${timeLeft <= 10 ? 'border-red-500 text-red-400 bg-red-900/20 animate-pulse' : 'border-white/10 bg-white/5'}`}>
                                <span className="text-[9px] text-gray-400 -mb-1 font-bold">SEC</span>
                                <span className="text-lg font-black font-mono">{timeLeft}</span>
                            </div>
                            <div className="flex flex-col hidden sm:flex">
                                <span className="text-[9px] text-gray-500 font-bold tracking-widest">ROUND</span>
                                <span className="text-lg font-bold text-white leading-none">{roomState.current_round} <span className="text-gray-600 text-sm">/ {roomState.total_rounds}</span></span>
                            </div>
                        </div>

                        <div className="flex flex-col items-center justify-center flex-1">
                            {roomState.selected_word ? (
                                <div className="animate-fade-in-down transform transition-all hover:scale-105 cursor-default">
                                    <span className="text-[10px] text-yellow-500/80 mb-1 block text-center font-bold tracking-widest uppercase">Theme</span>
                                    <div className="bg-gradient-to-r from-yellow-600/90 to-orange-600/90 border-t border-yellow-400/50 px-10 py-2 rounded-2xl shadow-[0_10px_20px_rgba(234,179,8,0.2)] text-center min-w-[200px] backdrop-blur-sm">
                                        <span className="text-white font-extrabold text-2xl drop-shadow-md tracking-wider">{roomState.selected_word}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white/5 px-6 py-2 rounded-full border border-white/5">
                                    <span className="text-gray-400 text-sm italic flex items-center gap-2">
                                        <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                                        주제 선정 중...
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3 min-w-0 w-1/4">
                            <div className="flex -space-x-3 hover:space-x-1 transition-all duration-300">
                                {users.map(u => (
                                    <div key={u.user_id} className="relative group transition-all hover:-translate-y-2">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all shadow-lg
                                    ${u.user_id === roomState.storyteller_id ? 'border-yellow-400 bg-gray-900 text-yellow-400 z-10' : 'border-gray-700 bg-gray-800 text-gray-400'} 
                                    ${u.user_id === myId ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-black' : ''}`}>
                                            <span className="font-bold text-sm">{u.username.substr(0, 1)}</span>
                                        </div>
                                        {u.user_id === roomState.storyteller_id && <div className="absolute -top-2 -right-1 bg-yellow-400 rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm border border-black z-20">👑</div>}
                                        {(roomState.phase === 'voting' ? u.voted : u.submitted) && u.user_id !== roomState.storyteller_id && (
                                            <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center text-[9px] shadow-sm border border-black z-20 text-black font-bold">✓</div>
                                        )}
                                        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-50 border border-white/10 shadow-xl">
                                            <p className="font-bold text-pink-300">{u.username}</p>
                                            <p>{u.score} Points</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setShowRules(true)} className="bg-white/5 hover:bg-white/20 w-10 h-10 rounded-full flex items-center justify-center border border-white/10 transition text-lg active:scale-95">❔</button>
                        </div>
                    </div>

                    <div className="flex-1 w-full overflow-y-auto flex flex-col items-center relative py-2 scrollbar-hide">
                        {roomState.phase === 'storyteller_choosing' && (
                            <>
                                {isStoryteller && !confirmedCard && (
                                    <div className="text-center mt-12 animate-fade-in-up">
                                        <h3 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-300 mb-3">Your Turn, Storyteller</h3>
                                        <p className="text-gray-400 text-base font-light tracking-wide">아래 덱에서 이야기를 시작할 카드를 선택해주세요.</p>
                                    </div>
                                )}
                                {isStoryteller && confirmedCard && (
                                    <div className="w-full h-fit flex flex-col md:flex-row items-center md:items-start justify-center gap-6 md:gap-12 px-6 max-w-6xl mx-auto pb-40 mt-8 animate-fade-in">
                                        <div className="relative w-full max-w-[280px] sm:max-w-[320px] md:max-w-md flex-shrink-0">
                                            <div className="relative group cursor-pointer perspective-1000" onClick={() => handleCardClick(confirmedCard)}>
                                                <img
                                                    src={confirmedCard.src}
                                                    loading="lazy"
                                                    className="w-full h-auto max-h-[35vh] md:max-h-[60vh] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-[6px] border-white/10 object-contain bg-black/30 transition-transform duration-500 hover:rotate-y-6"
                                                />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setConfirmedCard(null); setSelectedWord(null); }}
                                                    className="absolute -top-4 -right-4 bg-gray-800 text-white rounded-full p-3 border border-white/20 shadow-xl hover:bg-gray-700 transition z-10 transform hover:rotate-180 duration-300"
                                                >
                                                    🔄
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-center md:items-start w-full max-w-2xl">
                                            <div className="mb-6 text-center md:text-left">
                                                <h3 className="text-2xl md:text-4xl font-black text-white mb-2">단어 선택</h3>
                                                <p className="text-gray-400 text-sm font-light">이미지의 느낌을 가장 잘 표현하는 단어는 무엇인가요?</p>
                                            </div>

                                            <div className="w-full bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-md mb-6 shadow-2xl">
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Keywords</span>
                                                    <button onClick={handleRefreshWords} disabled={roomState.reroll_count <= 0}
                                                        className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-2 transition font-bold
                                                    ${roomState.reroll_count > 0 ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20' : 'bg-gray-700/50 border-gray-600 text-gray-500 cursor-not-allowed'}`}>
                                                        <span>🎲</span> 변경 ({roomState.reroll_count})
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                                    {roomState.word_candidates?.map((word) => (
                                                        <button
                                                            key={word}
                                                            onClick={() => setSelectedWord(word)}
                                                            className={`py-3 px-1 text-xs md:text-sm rounded-xl font-bold border transition-all duration-200 
                                                        ${selectedWord === word
                                                                    ? 'bg-gradient-to-br from-pink-500 to-purple-600 border-transparent text-white shadow-lg scale-105 ring-2 ring-pink-300/50'
                                                                    : 'bg-black/40 border-white/5 text-gray-400 hover:bg-white/10 hover:border-white/20'}`}
                                                        >
                                                            {word}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleSubmitStory}
                                                disabled={!selectedWord}
                                                className={`w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all duration-300 relative overflow-hidden group
                                            ${selectedWord
                                                        ? 'bg-gradient-to-r from-green-500 to-teal-500 text-white hover:shadow-green-500/40 hover:-translate-y-1'
                                                        : 'bg-gray-800/50 text-gray-600 cursor-not-allowed border border-white/5'}`}
                                            >
                                                {selectedWord && <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>}
                                                {selectedWord ? `"${selectedWord}" (으)로 결정하기` : '단어를 선택해주세요'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {!isStoryteller && (
                                    <div className="flex flex-col items-center justify-center mt-32 animate-pulse">
                                        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 relative">
                                            <div className="absolute inset-0 border-4 border-t-pink-500 border-r-transparent border-b-purple-500 border-l-transparent rounded-full animate-spin"></div>
                                            <span className="text-4xl">🤔</span>
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-2">이야기꾼이 고민 중입니다...</h3>
                                        <p className="text-gray-500">어떤 기상천외한 단어가 나올까요?</p>
                                    </div>
                                )}
                            </>
                        )}

                        {roomState.phase === 'audience_submitting' && (
                            <div className="flex flex-col items-center justify-center w-full max-w-2xl mt-12 px-4 animate-fade-in-up">
                                <div className="w-full glass-card p-10 rounded-[3rem] text-center shadow-2xl relative overflow-hidden border border-white/20 backdrop-blur-xl">
                                    <div className="absolute -top-20 -left-20 w-60 h-60 bg-purple-500/20 rounded-full blur-3xl animate-blob opacity-60"></div>
                                    <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-pink-500/20 rounded-full blur-3xl animate-blob delay-2000 opacity-60"></div>

                                    {!isStoryteller && !amISubmitted ? (
                                        <div className="relative z-10">
                                            <h2 className="text-3xl font-black text-white mb-3">당신의 카드를 선택하세요!</h2>
                                            <p className="text-gray-300 mb-8 font-light">주제 <span className="text-yellow-400 font-bold">"{roomState.selected_word}"</span> 와(과) 가장 잘 어울리는 이미지는?</p>

                                            {targetSubmitCount > 1 && (
                                                <div className="inline-block bg-white/10 text-pink-300 px-6 py-2 rounded-full text-sm font-bold border border-white/20 mb-6">
                                                    {mySubmitCount} / {targetSubmitCount}장 제출됨
                                                </div>
                                            )}
                                            <div className="flex justify-center">
                                                <div className="animate-bounce bg-white/10 p-2 rounded-full border border-white/10 text-2xl">👇</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative z-10">
                                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/50">
                                                <span className="text-3xl">✅</span>
                                            </div>
                                            <h2 className="text-2xl font-bold text-green-300 mb-2">제출 완료!</h2>
                                            <p className="text-gray-400 text-sm mb-6">다른 플레이어들이 고민 중입니다...</p>
                                            <div className="flex justify-center gap-1">
                                                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                                                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></span>
                                                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-8 text-center max-w-md">
                                    <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em] mb-2 block font-bold">Game Tip</span>
                                    <p className="text-gray-400 text-sm italic bg-black/40 px-6 py-3 rounded-2xl border border-white/5 backdrop-blur-sm">
                                        "{currentTip}"
                                    </p>
                                </div>
                            </div>
                        )}

                        {roomState.phase === 'voting' && (
                            <div className="w-full flex flex-col items-center">
                                <div className="text-center mb-8 animate-fade-in-down">
                                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2">
                                        {isStoryteller ? "👀 투표 결과를 기다리는 중..." : amIVoted ? "✅ 투표 완료! 결과는?" : "🤔 정답을 찾아보세요!"}
                                    </h2>
                                    <p className="text-gray-400 text-sm font-light">이야기꾼의 카드는 무엇일까요?</p>
                                </div>
                                {(!roomState.voting_candidates || roomState.voting_candidates.length === 0) ? (
                                    <div className="text-gray-400 animate-pulse mt-20">카드 섞는 중...</div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 p-6 w-full max-w-7xl animate-fade-in-up">
                                        {roomState.voting_candidates.map((card) => {
                                            const isMyVoted = amIVoted && card.card_id === myVotedCardId;
                                            return (
                                                <div key={card.card_id} onClick={() => handleCardClick(card, true)}
                                                    className={`relative aspect-[2/3] group cursor-pointer transition-all duration-500 ease-out
                                            ${amIVoted ? (isMyVoted ? 'scale-105 z-10 ring-4 ring-blue-500 rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.5)]' : 'opacity-40 grayscale pointer-events-none') : 'hover:scale-105 hover:-translate-y-2 hover:shadow-2xl hover:z-10'} 
                                            ${card.user_id === myId ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl z-10"></div>
                                                    <img
                                                        src={card.card_src}
                                                        loading="lazy"
                                                        className="w-full h-full rounded-2xl shadow-xl object-cover border border-white/10 bg-gray-800"
                                                    />
                                                    {card.user_id === myId && (
                                                        <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center backdrop-blur-[2px]">
                                                            <span className="text-white font-bold border border-white/30 px-3 py-1.5 rounded-full text-xs bg-black/50">⛔ 내 카드</span>
                                                        </div>
                                                    )}
                                                    {isMyVoted && <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg z-20 border border-blue-400">PICK ✅</div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {roomState.phase === 'result' && (
                            <div className="w-full flex flex-col items-center animate-fade-in-up pb-32">
                                {resultMessage && (
                                    <div className="mb-8 text-center animate-bounce-in mt-4">
                                        <h3 className="text-xl md:text-3xl font-black text-white drop-shadow-lg bg-white/10 px-8 py-3 rounded-full border border-white/20 backdrop-blur-md shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                                            {resultMessage}
                                        </h3>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 mb-8">
                                    <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-gray-500"></div>
                                    <h2 className="text-2xl font-bold text-gray-300 uppercase tracking-widest">Round Results</h2>
                                    <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-gray-500"></div>
                                </div>

                                <div className="flex flex-wrap justify-center gap-8 mb-10 w-full mt-4 px-4">
                                    {roomState.round_results?.map((res, idx) => (
                                        <div key={idx} className={`relative flex flex-col items-center group perspective-1000 ${res.is_storyteller ? 'order-first' : ''}`}>
                                            {res.is_storyteller && (
                                                <div className="absolute -top-6 z-20">
                                                    <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-black px-4 py-1.5 rounded-full shadow-lg animate-bounce border-2 border-white">
                                                        👑 정답 카드
                                                    </span>
                                                </div>
                                            )}
                                            <div className={`w-40 h-60 rounded-2xl overflow-hidden shadow-2xl border-4 bg-gray-900 mb-4 transition-transform duration-500 hover:rotate-y-12 hover:scale-105 relative
                                        ${res.is_storyteller ? 'border-yellow-400 shadow-[0_0_40px_rgba(234,179,8,0.3)]' : 'border-gray-700'}`}>
                                                <img
                                                    src={res.card_src}
                                                    loading="lazy"
                                                    className="w-full h-full object-cover"
                                                    alt="result"
                                                />
                                                <div className="absolute bottom-0 left-0 w-full bg-black/70 backdrop-blur-sm p-2 text-center">
                                                    <span className={`text-xs font-bold ${res.is_storyteller ? 'text-yellow-300' : 'text-white'}`}>{res.username}</span>
                                                </div>
                                            </div>

                                            {res.voters && res.voters.length > 0 ? (
                                                <div className="bg-black/40 rounded-xl p-3 border border-white/10 min-w-[120px] text-center backdrop-blur-sm">
                                                    <span className="text-[10px] text-gray-400 mb-2 block uppercase tracking-wider font-bold">Voters</span>
                                                    <div className="flex gap-1.5 flex-wrap justify-center">
                                                        {res.voters.map((voterName, vIdx) => (
                                                            <span key={vIdx} className="bg-blue-500/20 border border-blue-500/30 text-[10px] px-2 py-0.5 rounded-md text-blue-200 shadow-sm font-bold">
                                                                {voterName}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : <div className="text-[10px] text-gray-600 italic mt-2">득표 없음</div>}
                                        </div>
                                    ))}
                                </div>

                                <div className="w-full max-w-3xl px-6 mb-8">
                                    <h3 className="text-gray-400 text-xs font-bold mb-3 uppercase tracking-wider ml-1">Scoreboard</h3>
                                    <div className="flex flex-col gap-3">
                                        {users.map(u => (
                                            <div key={u.user_id} className={`flex justify-between items-center px-6 py-4 rounded-2xl border transition-all duration-300
                                        ${u.user_id === myId
                                                    ? 'bg-gradient-to-r from-pink-900/40 to-purple-900/40 border-pink-500/40 shadow-lg transform scale-[1.02]'
                                                    : 'bg-white/5 border-white/5'}`}>
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-bold text-base ${u.user_id === myId ? 'text-pink-300' : 'text-gray-200'}`}>
                                                            {u.username}
                                                        </span>
                                                        {u.user_id === myId && <span className="bg-pink-500 text-[9px] text-white px-1.5 rounded font-bold">ME</span>}
                                                    </div>
                                                    <span className="text-xs text-gray-500 italic mt-0.5">{u.last_score_reason || "대기 중"}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {u.last_gained_score > 0 && (
                                                        <span className="text-sm font-bold text-green-400 animate-pulse-fast bg-green-400/10 px-2 py-0.5 rounded-lg border border-green-400/20">
                                                            +{u.last_gained_score}
                                                        </span>
                                                    )}
                                                    <span className="text-2xl font-black text-white font-mono">{u.score}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleNextRound}
                                    disabled={resultDelayCount > 0}
                                    className={`relative overflow-hidden font-black py-4 px-12 rounded-full text-lg shadow-2xl transition-all transform hover:-translate-y-1 mb-10
                                ${resultDelayCount > 0
                                            ? 'bg-gray-700 text-gray-500 cursor-wait border border-gray-600'
                                            : 'bg-white text-black hover:bg-gray-100 hover:shadow-white/20'}`}
                                >
                                    {resultDelayCount > 0 ? (
                                        <span className="flex items-center gap-2">
                                            <span className="animate-spin text-xl">⏳</span>
                                            <span>집계 중... {resultDelayCount}</span>
                                        </span>
                                    ) : (
                                        <>{roomState.current_round >= roomState.total_rounds ? "🏆 최종 결과 보기" : "다음 라운드 진행 ➡️"}</>
                                    )}
                                </button>
                            </div>
                        )}

                        {roomState.phase === 'game_over' && (
                            <div className="text-center animate-fade-in-up mt-10 w-full flex flex-col items-center">
                                <div className="mb-8 relative">
                                    <div className="absolute -inset-10 bg-yellow-500/20 blur-3xl rounded-full animate-pulse"></div>
                                    <h2 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-orange-500 relative z-10 drop-shadow-sm">
                                        {getGameOverMessage(users.sort((a, b) => b.score - a.score))}
                                    </h2>
                                </div>

                                <div className="w-full max-w-md bg-black/40 p-1 rounded-[2.5rem] border border-white/10 shadow-2xl backdrop-blur-xl mb-10 overflow-hidden">
                                    {users.sort((a, b) => b.score - a.score).map((u, idx) => (
                                        <div key={u.user_id} className={`flex justify-between items-center py-5 px-8 border-b border-white/5 last:border-0 relative overflow-hidden
                                    ${idx === 0 ? 'bg-gradient-to-r from-yellow-500/10 to-transparent' : ''}`}>
                                            <div className="flex items-center gap-5 relative z-10">
                                                <div className={`w-12 h-12 flex items-center justify-center rounded-2xl font-black text-2xl
                                            ${idx === 0 ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/30' :
                                                        idx === 1 ? 'bg-gray-300 text-black' :
                                                            idx === 2 ? 'bg-amber-700 text-white' : 'bg-gray-800 text-gray-500'}`}>
                                                    {idx + 1}
                                                </div>
                                                <div className="text-left">
                                                    <div className={`font-bold text-lg ${idx === 0 ? 'text-yellow-200' : 'text-white'}`}>{u.username}</div>
                                                    {u.user_id === myId && <div className="text-[10px] text-gray-500 font-bold tracking-wider">IT'S ME</div>}
                                                </div>
                                            </div>
                                            <span className={`font-mono text-2xl font-bold relative z-10 ${idx === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>{u.score}</span>
                                        </div>
                                    ))}
                                </div>
                                <button onClick={handleBackToLobby} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-4 px-12 rounded-2xl transition hover:scale-105 active:scale-95">로비로 돌아가기</button>
                            </div>
                        )}
                    </div>

                    {['storyteller_choosing', 'audience_submitting'].includes(roomState.phase) && !(isStoryteller && confirmedCard) && (
                        <div className={`fixed bottom-0 left-0 w-full z-50 pointer-events-none transition-all duration-700 ease-in-out ${amISubmitted ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'}`}>
                            <div className="bg-gradient-to-t from-black via-black/90 to-transparent pt-10 pb-6 px-4">
                                <div className="flex justify-center w-full">
                                    <div className="flex gap-3 overflow-x-auto px-4 pb-8 h-64 items-end scrollbar-hide w-fit mx-auto max-w-full pointer-events-auto snap-x">
                                        {myHand.map((card) => {
                                            const isSubmittedLocal = mySubmittedCards.includes(card.id);
                                            const isMyStoryCard = isStoryteller && roomState.storyteller_card_id === card.id;
                                            return (
                                                <div key={card.id} onClick={() => handleCardClick(card)}
                                                    className={`snap-center flex-none w-[110px] h-36 bg-gray-800 rounded-xl cursor-pointer hover:-translate-y-6 hover:scale-110 transition-all duration-300 shadow-2xl border-2 overflow-hidden relative group 
                                            ${confirmedCard?.id === card.id ? 'opacity-50 grayscale scale-95' : 'border-white/10 hover:border-pink-400 hover:shadow-pink-500/30'} 
                                            ${isSubmittedLocal ? 'opacity-40 border-green-500' : ''}
                                            ${isMyStoryCard ? 'ring-4 ring-yellow-500 opacity-70' : ''}`}>
                                                    <img
                                                        src={card.src}
                                                        loading="lazy"
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                    />
                                                    {isSubmittedLocal && <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm"><span className="text-3xl font-bold">✅</span></div>}
                                                    {isMyStoryCard && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm"><span className="text-2xl">📖</span><span className="text-[9px] text-yellow-300 font-bold mt-1 uppercase tracking-wider">Selected</span></div>}
                                                    {card.is_new && <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg shadow-md animate-pulse z-10">NEW</div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {zoomCard && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl select-none touch-none animate-fade-in"
                            onClick={() => setZoomCard(null)}
                            onTouchStart={onTouchStart}
                            onTouchMove={onTouchMove}
                            onTouchEnd={onTouchEnd}
                        >
                            <div className="relative w-full h-full flex flex-col items-center justify-center p-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>

                                {roomState.selected_word && (
                                    <div className="flex-none z-[130] animate-fade-in-down pointer-events-none mb-4">
                                        <div className="bg-black/40 px-8 py-3 rounded-full border border-white/10 backdrop-blur-md shadow-2xl flex flex-col items-center">
                                            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">Current Theme</span>
                                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-orange-200 font-black text-2xl tracking-wider">"{roomState.selected_word}"</span>
                                        </div>
                                    </div>
                                )}

                                <div className="flex-1 w-full max-w-6xl min-h-0 flex items-center justify-center pointer-events-none relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handlePrevZoom(); }}
                                        className="hidden sm:block absolute left-4 z-[120] p-4 bg-white/5 hover:bg-white/10 rounded-full text-3xl transition backdrop-blur-md border border-white/10 pointer-events-auto text-white/70 hover:text-white"
                                    >
                                        <span className="block transform scale-x-[-1]">➜</span>
                                    </button>

                                    <div className="relative w-full max-w-lg h-full flex items-center justify-center aspect-[2/3] pointer-events-auto perspective-1000">
                                        <img
                                            key={zoomCard.id || zoomCard.card_id}
                                            src={zoomCard.src || zoomCard.card_src}
                                            loading="lazy"
                                            className={`w-auto h-auto max-w-full max-h-full object-contain rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] pointer-events-none transition-all duration-300 ${slideDirection > 0 ? 'animate-slide-right' : slideDirection < 0 ? 'animate-slide-left' : ''}`}
                                        />
                                        {mySubmittedCards.includes(zoomCard.id) && !zoomCard.isVotingCandidate && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-3xl backdrop-blur-sm">
                                                <div className="text-green-400 font-bold text-5xl border-4 border-green-400 rounded-full w-28 h-28 flex items-center justify-center animate-bounce shadow-[0_0_20px_rgba(74,222,128,0.5)]">
                                                    ✓
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleNextZoom(); }}
                                        className="hidden sm:block absolute right-4 z-[120] p-4 bg-white/5 hover:bg-white/10 rounded-full text-3xl transition backdrop-blur-md border border-white/10 pointer-events-auto text-white/70 hover:text-white"
                                    >
                                        ➜
                                    </button>
                                </div>

                                <div className="flex-none z-[120] w-full max-w-md px-4 flex flex-col sm:flex-row justify-center gap-4 mt-6 pointer-events-auto">
                                    <button onClick={() => setZoomCard(null)} className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-black/50 hover:bg-black/70 border border-white/20 font-bold backdrop-blur-md transition text-white/80 hover:text-white shadow-lg">닫기</button>
                                    {((isStoryteller && !confirmedCard && roomState.phase === 'storyteller_choosing' && !zoomCard.isVotingCandidate) ||
                                        (!isStoryteller && !amISubmitted && roomState.phase === 'audience_submitting' && !zoomCard.isVotingCandidate && !mySubmittedCards.includes(zoomCard.id))) && (
                                            <button onClick={confirmCardSelection} className="w-full sm:flex-1 py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:scale-[1.02] font-black text-lg shadow-xl transition border border-white/20 active:scale-95">
                                                {isStoryteller ? '이 카드로 결정! 🎯' : (targetSubmitCount > 1 ? `제출 (${mySubmitCount + 1}/${targetSubmitCount})` : '이 카드로 제출! 🔥')}
                                            </button>
                                        )}

                                    {(!isStoryteller && roomState.phase === 'audience_submitting' && !zoomCard.isVotingCandidate && mySubmittedCards.includes(zoomCard.id)) && (
                                        <button disabled className="w-full sm:flex-1 py-4 rounded-2xl bg-gray-700/50 text-gray-500 font-bold shadow-xl cursor-not-allowed border border-gray-600/50">
                                            제출 완료됨
                                        </button>
                                    )}

                                    {(!isStoryteller && !amIVoted && roomState.phase === 'voting' && zoomCard.isVotingCandidate && zoomCard.user_id !== myId) && (
                                        <button onClick={confirmCardSelection} className="w-full sm:flex-1 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-600 hover:scale-[1.02] font-black text-lg shadow-xl transition animate-pulse border border-white/20">🗳️ 이게 정답이다!</button>
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