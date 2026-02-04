import io from 'socket.io-client';

// [수정됨] 구매하신 도메인과 HTTPS 프로토콜 적용 (API 서버 주소)
const SOCKET_URL = 'https://api.lumiverselab.com';

const socket = io(SOCKET_URL, {
  transports: ['websocket'], // 모바일 접속 안정성을 위해 웹소켓 우선 사용
  autoConnect: false,        // 필요할 때만 연결 (로그인 후 등)
});

export default socket;