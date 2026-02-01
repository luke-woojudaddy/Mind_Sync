import io from 'socket.io-client';

// ▼ 여기에 본인 맥북 IP와 포트(5050)를 적어주세요.
const SOCKET_URL = 'http://192.168.0.43:5050';

const socket = io(SOCKET_URL, {
  transports: ['websocket'], // 모바일 접속 안정성을 위해 웹소켓 우선 사용
  autoConnect: false,        // 필요할 때만 연결 (로그인 후 등)
});

export default socket;