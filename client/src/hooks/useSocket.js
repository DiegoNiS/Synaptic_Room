import { useEffect, useState, useCallback } from 'react';
import { initSocket, getSocket, disconnectSocket } from '../socket';

/**
 * Custom React hook to manage the lifecycle and real-time state of the Socket.io connection.
 * Supports student views (cognitive states, mentorships) and teacher views (node maps).
 * 
 * @param {Object} auth - Credentials for Socket.io handshake
 * @param {string} [auth.studentId]
 * @param {string} [auth.sessionId]
 * @param {string} [auth.role]
 * @param {string} [auth.displayName]
 */
export function useSocket(auth) {
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const [cognitiveState, setCognitiveState] = useState({
    state: 'idle',
    confidence: 0,
    blockagePoint: null,
  });
  const [activeMentorship, setActiveMentorship] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [nodeMap, setNodeMap] = useState({ nodes: [], sessionId: '', updatedAt: 0 });

  // Initialize Socket.io
  useEffect(() => {
    if (!auth || !auth.studentId || !auth.sessionId || !auth.displayName) {
      return;
    }

    const socket = initSocket(auth);

    const onConnect = () => {
      setConnected(true);
      setSocketError(null);
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onConnectError = (err) => {
      setConnected(false);
      setSocketError(err.message || 'Connection failed');
    };

    const onSessionError = (err) => {
      setSocketError(err.message || 'Session error');
    };

    // Listeners for Student
    const onCognitiveState = (data) => {
      // Only care if it matches the current student's state
      if (data.studentId === auth.studentId) {
        setCognitiveState({
          state: data.state,
          confidence: data.confidence,
          blockagePoint: data.blockagePoint,
        });
      }
    };

    const onMentorshipStart = (payload) => {
      // Check if current student is involved (either as mentor or mentee)
      const isMentor = payload.mentor.studentId === auth.studentId;
      const isMentee = payload.mentee.studentId === auth.studentId;

      if (isMentor || isMentee) {
        setActiveMentorship({
          ...payload,
          role: isMentor ? 'mentor' : 'mentee',
          partnerName: isMentor ? payload.mentee.displayName : payload.mentor.displayName,
          partnerId: isMentor ? payload.mentee.studentId : payload.mentor.studentId,
        });
        setChatMessages([]);
      }
    };

    const onMentorshipEnded = (payload) => {
      setActiveMentorship((current) => {
        if (current && current.mentorshipId === payload.mentorshipId) {
          // Revert cognitive state dynamically
          setCognitiveState(prev => ({
            ...prev,
            state: 'idle',
            confidence: 0,
            blockagePoint: null,
          }));
          setChatMessages([]);
          return null;
        }
        return current;
      });
    };

    const onMentorshipMessage = (payload) => {
      setActiveMentorship((current) => {
        if (current && current.mentorshipId === payload.mentorshipId) {
          setChatMessages((prev) => [...prev, payload]);
        }
        return current;
      });
    };

    // Listeners for Teacher
    const onSessionNodeMap = (data) => {
      if (auth.role === 'teacher') {
        setNodeMap(data);
      }
    };

    // Register events
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('session:error', onSessionError);
    socket.on('cognitive:state', onCognitiveState);
    socket.on('mentorship:start', onMentorshipStart);
    socket.on('mentorship:ended', onMentorshipEnded);
    socket.on('mentorship:message', onMentorshipMessage);
    socket.on('session:nodeMap', onSessionNodeMap);

    // Initial connection state check
    if (socket.connected) {
      onConnect();
    }

    // Cleanup on unmount
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('session:error', onSessionError);
      socket.off('cognitive:state', onCognitiveState);
      socket.off('mentorship:start', onMentorshipStart);
      socket.off('mentorship:ended', onMentorshipEnded);
      socket.off('mentorship:message', onMentorshipMessage);
      socket.off('session:nodeMap', onSessionNodeMap);
      disconnectSocket();
    };
  }, [auth?.studentId, auth?.sessionId, auth?.role, auth?.displayName]);

  // Send keystroke trace
  const sendTrace = useCallback((metrics) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('student:trace', {
        timestamp: Date.now(),
        metrics,
      });
    }
  }, []);

  // Send message in active mentorship chat
  const sendChatMessage = useCallback((messageText) => {
    const socket = getSocket();
    if (socket && socket.connected && activeMentorship) {
      const payload = {
        mentorshipId: activeMentorship.mentorshipId,
        message: messageText,
        targetStudentId: activeMentorship.partnerId,
      };
      
      socket.emit('mentorship:message', payload);

      // Append own message locally
      setChatMessages((prev) => [
        ...prev,
        {
          mentorshipId: activeMentorship.mentorshipId,
          from: auth.studentId,
          fromName: auth.displayName,
          message: messageText,
          timestamp: Date.now(),
        },
      ]);
    }
  }, [activeMentorship, auth]);

  // Request to close active mentorship
  const closeMentorship = useCallback((reason = 'resolved') => {
    const socket = getSocket();
    if (socket && socket.connected && activeMentorship) {
      socket.emit('mentorship:close', {
        mentorshipId: activeMentorship.mentorshipId,
        reason,
      });
    }
  }, [activeMentorship]);

  return {
    connected,
    socketError,
    cognitiveState,
    activeMentorship,
    chatMessages,
    nodeMap,
    sendTrace,
    sendChatMessage,
    closeMentorship,
  };
}
