import { io } from 'socket.io-client';

let socket = null;

/**
 * Initializes a new Socket.io connection with handshake credentials.
 * @param {Object} auth - Connection credentials
 * @param {string} auth.studentId
 * @param {string} auth.sessionId
 * @param {string} auth.role - 'student' | 'teacher'
 * @param {string} auth.displayName
 * @returns {import('socket.io-client').Socket}
 */
export const initSocket = (auth) => {
  if (socket) {
    socket.disconnect();
  }

  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

  socket = io(serverUrl, {
    auth,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socket;
};

/**
 * Returns the active Socket.io instance.
 * @returns {import('socket.io-client').Socket|null}
 */
export const getSocket = () => {
  return socket;
};

/**
 * Disconnects the active Socket.io connection.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
