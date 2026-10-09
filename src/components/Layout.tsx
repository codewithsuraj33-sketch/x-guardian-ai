// ─────────────────────────────────────────────
// X-Guardian — App Layout
// ─────────────────────────────────────────────

import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import EmergencyAlertModal from './EmergencyAlertModal';
import { useFactory } from '../context/FactoryContext';

export default function Layout() {
  const { emergencyAlert, dismissAlert, orderEvacuation, acknowledgeAlert } = useFactory();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <EmergencyAlertModal
        alert={emergencyAlert}
        onClose={dismissAlert}
        onEvacuate={orderEvacuation}
        onAcknowledge={acknowledgeAlert}
      />
    </div>
  );
}
