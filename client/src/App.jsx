import React from 'react';
import { BrowserRouter, Routes, Route, useParams, useSearchParams, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import StudentView from './pages/StudentView';
import TeacherView from './pages/TeacherView';

// ── Student route wrapper — extracts URL params ──
function StudentRoute() {
  const { studentId } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const displayName = searchParams.get('name');

  if (!sessionId || !displayName) {
    return <Navigate to="/" replace />;
  }

  return (
    <StudentView
      studentId={studentId}
      sessionId={sessionId}
      displayName={displayName}
    />
  );
}

// ── Teacher route wrapper ──
function TeacherRoute() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const teacherName = searchParams.get('name') || 'Docente';

  if (!sessionId) {
    return <Navigate to="/" replace />;
  }

  return (
    <TeacherView
      sessionId={sessionId}
      teacherName={teacherName}
    />
  );
}

// ── Root App ──
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/student/:studentId" element={<StudentRoute />} />
        <Route path="/teacher" element={<TeacherRoute />} />
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
