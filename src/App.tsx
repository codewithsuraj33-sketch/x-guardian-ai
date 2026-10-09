// ─────────────────────────────────────────────
// X-Guardian — Root App Component
// ─────────────────────────────────────────────

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SafetyProvider } from './context/SafetyContext';
import { FactoryProvider } from './context/FactoryContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import Factory from './pages/Factory';
import Workers from './pages/Workers';
import Incidents from './pages/Incidents';
import Analytics from './pages/Analytics';
import History from './pages/History';
import Settings from './pages/Settings';
export default function App() {
  return (
    <SafetyProvider>
      <FactoryProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="cameras" element={<Cameras />} />
              <Route path="factory" element={<Factory />} />
              <Route path="workers" element={<Workers />} />
              <Route path="incidents" element={<Incidents />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="history" element={<History />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </FactoryProvider>
    </SafetyProvider>
  );
}
