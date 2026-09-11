// ─────────────────────────────────────────────
// X-Guardian — Root App Component
// ─────────────────────────────────────────────

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SafetyProvider } from './context/SafetyContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import History from './pages/History';
import Settings from './pages/Settings';

export default function App() {
  return (
    <SafetyProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="cameras" element={<Cameras />} />
            <Route path="history" element={<History />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SafetyProvider>
  );
}
