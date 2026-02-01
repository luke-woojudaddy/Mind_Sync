import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5050';

/**
 * 새 방 생성
 * @param {string} roomName - 방 이름
 * @returns {Promise<object>} - 생성된 방 정보
 */
export const createRoom = async (roomName) => {
  const response = await axios.post(`${API_URL}/api/rooms`, {
    name: roomName,
  });
  return response.data;
};

/**
 * 방 정보 조회
 * @param {string} roomId - 방 ID
 * @returns {Promise<object>} - 방 정보
 */
export const getRoom = async (roomId) => {
  const response = await axios.get(`${API_URL}/api/rooms/${roomId}`);
  return response.data;
};

/**
 * 모든 방 목록 조회
 * @returns {Promise<object>} - 방 목록
 */
export const getRooms = async () => {
  const response = await axios.get(`${API_URL}/api/rooms`);
  return response.data;
};

/**
 * 방 입장 (사용자 참여)
 * @param {string} roomId - 방 ID
 * @param {string} username - 사용자 이름 (선택)
 * @returns {Promise<object>} - 입장 결과
 */
export const joinRoom = async (roomId, username = 'Guest') => {
  const response = await axios.post(`${API_URL}/api/rooms/${roomId}/users`, {
    username: username,
  });
  return response.data;
};
