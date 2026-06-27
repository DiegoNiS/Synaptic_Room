import { useEffect, useState, useRef, useCallback } from 'react';
import { initSocket, getSocket, disconnectSocket } from '../socket';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

/**
 * Requests a signed join token from the server. When auth is enabled the token
 * authorizes the socket handshake; in dev the server returns token:null and the
 * socket connects with raw identity. Returns the resolved identity to use.
 */
async function requestJoinToken(auth) {
  const resp = await fetch(`${SERVER_URL}/api/auth/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: auth.sessionId,
      role: auth.role,
      displayName: auth.displayName,
      studentId: auth.studentId,
      passcode: auth.passcode,
    }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    const err = new Error(body.error || `Auth failed (${resp.status})`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

/**
 * Manages the Socket.io lifecycle and real-time state for both student and
 * teacher views.
 * @param {Object} auth - { studentId, sessionId, role, displayName, passcode? }
 */
export function useSocket(auth) {
  const [connected, setConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const [cognitiveState, setCognitiveState] = useState({ state: 'idle', confidence: 0, blockagePoint: null });
  const [activeMentorship, setActiveMentorship] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [incomingStrokes, setIncomingStrokes] = useState([]);
  const [nodeMap, setNodeMap] = useState({ nodes: [], sessionId: '', updatedAt: 0 });
  const [aiError, setAiError] = useState(null);
  const [aiErrors, setAiErrors] = useState({});

  // The server-resolved identity (used for matching incoming events).
  const myIdRef = useRef(auth?.studentId);

  useEffect(() => {
    if (!auth || !auth.sessionId || !auth.displayName) return;

    let cancelled = false;
    let socket = null;

    (async () => {
      // 1. Resolve identity + token (graceful fallback if the endpoint is down).
      let connectAuth = { ...auth };
      try {
        const identity = await requestJoinToken(auth);
        connectAuth = {
          studentId: identity.studentId,
          sessionId: identity.sessionId,
          role: identity.role,
          displayName: identity.displayName,
          token: identity.token,
        };
      } catch (err) {
        if (err.status === 403) {
          if (!cancelled) setSocketError(err.message || 'Acceso denegado');
          return; // Do not connect on an authorization failure.
        }
        // Network/endpoint failure → connect with raw identity (dev fallback).
        console.warn('[useSocket] token request failed, connecting without token:', err.message);
      }
      if (cancelled) return;

      const myId = connectAuth.studentId;
      myIdRef.current = myId;
      socket = initSocket(connectAuth);

      const onConnect = () => { setConnected(true); setSocketError(null); };
      const onDisconnect = () => setConnected(false);
      const onConnectError = (err) => { setConnected(false); setSocketError(err.message || 'Connection failed'); };
      const onSessionError = (err) => setSocketError(err.message || 'Session error');

      const onCognitiveState = (data) => {
        if (data.studentId === myId) {
          setCognitiveState({ state: data.state, confidence: data.confidence, blockagePoint: data.blockagePoint });
        }
      };

      const onMentorshipStart = (payload) => {
        const isMentor = payload.mentor.studentId === myId;
        const isMentee = payload.mentee.studentId === myId;
        if (isMentor || isMentee) {
          setActiveMentorship({
            ...payload,
            role: isMentor ? 'mentor' : 'mentee',
            partnerName: isMentor ? payload.mentee.displayName : payload.mentor.displayName,
            partnerId: isMentor ? payload.mentee.studentId : payload.mentor.studentId,
          });
          setChatMessages([]);
          setIncomingStrokes([]);
        }
      };

      const onMentorshipEnded = (payload) => {
        setActiveMentorship((current) => {
          if (current && current.mentorshipId === payload.mentorshipId) {
            setChatMessages([]);
            setIncomingStrokes([]);
            return null;
          }
          return current;
        });
        // Server also emits an authoritative cognitive:state; this is a fast local revert.
      };

      const onMentorshipMessage = (payload) => {
        setActiveMentorship((current) => {
          if (current && current.mentorshipId === payload.mentorshipId) {
            setChatMessages((prev) => [...prev, payload]);
          }
          return current;
        });
      };

      const onMentorshipDraw = (payload) => {
        setActiveMentorship((current) => {
          if (current && current.mentorshipId === payload.mentorshipId && payload.stroke) {
            setIncomingStrokes((prev) => [...prev, payload.stroke]);
          }
          return current;
        });
      };

      const onSessionNodeMap = (data) => {
        if (connectAuth.role === 'teacher') setNodeMap(data);
      };

      const onAiError = (data) => {
        if (connectAuth.role === 'teacher') setAiErrors((prev) => ({ ...prev, [data.studentId]: data.message }));
        else if (data.studentId === myId) setAiError(data.message);
      };
      const onAiClearError = (data) => {
        if (connectAuth.role === 'teacher') {
          setAiErrors((prev) => { const next = { ...prev }; delete next[data.studentId]; return next; });
        } else if (data.studentId === myId) setAiError(null);
      };

      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on('session:error', onSessionError);
      socket.on('cognitive:state', onCognitiveState);
      socket.on('mentorship:start', onMentorshipStart);
      socket.on('mentorship:ended', onMentorshipEnded);
      socket.on('mentorship:message', onMentorshipMessage);
      socket.on('mentorship:draw', onMentorshipDraw);
      socket.on('session:nodeMap', onSessionNodeMap);
      socket.on('ai:error', onAiError);
      socket.on('ai:clear-error', onAiClearError);

      if (socket.connected) onConnect();
    })();

    return () => {
      cancelled = true;
      disconnectSocket();
      setConnected(false);
    };
  }, [auth?.studentId, auth?.sessionId, auth?.role, auth?.displayName]);

  const sendTrace = useCallback((metrics) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('student:trace', { timestamp: Date.now(), metrics });
    }
  }, []);

  const sendChatMessage = useCallback((messageText) => {
    const socket = getSocket();
    if (socket && socket.connected && activeMentorship) {
      socket.emit('mentorship:message', {
        mentorshipId: activeMentorship.mentorshipId,
        message: messageText,
        targetStudentId: activeMentorship.partnerId,
      });
      setChatMessages((prev) => [
        ...prev,
        {
          mentorshipId: activeMentorship.mentorshipId,
          from: myIdRef.current,
          fromName: auth.displayName,
          message: messageText,
          timestamp: Date.now(),
        },
      ]);
    }
  }, [activeMentorship, auth?.displayName]);

  const sendDraw = useCallback((stroke) => {
    const socket = getSocket();
    if (socket && socket.connected && activeMentorship) {
      socket.emit('mentorship:draw', { mentorshipId: activeMentorship.mentorshipId, stroke });
    }
  }, [activeMentorship]);

  const closeMentorship = useCallback((reason = 'resolved') => {
    const socket = getSocket();
    if (socket && socket.connected && activeMentorship) {
      socket.emit('mentorship:close', { mentorshipId: activeMentorship.mentorshipId, reason });
    }
  }, [activeMentorship]);

  return {
    connected,
    socketError,
    cognitiveState,
    activeMentorship,
    chatMessages,
    incomingStrokes,
    nodeMap,
    aiError,
    aiErrors,
    sendTrace,
    sendChatMessage,
    sendDraw,
    closeMentorship,
  };
}
