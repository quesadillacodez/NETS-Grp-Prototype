import { ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getCurrentUser, isAdminUser } from '../utils/userStorage';
import { useAppEvents } from '../utils/useAppEvents';

interface MobileFrameProps {
  children: ReactNode;
}

// Pages an admin IS allowed to stay on. Everything else redirects to /admin.
const ADMIN_ALLOWED = ['/admin', '/manage-merchants'];

function AdminRedirectGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tick, setTick] = useState(0);
  useAppEvents(['userSwitched', 'databaseReady'], () => setTick((t) => t + 1));

  const admin = isAdminUser(getCurrentUser());
  const path = location.pathname;

  // Admin on a normal user page → send to the portal.
  if (admin && !ADMIN_ALLOWED.includes(path) && path !== '/admin') {
    queueMicrotask(() => navigate('/admin', { replace: true }));
  }
  // Non-admin who ended up on an admin-only page (e.g. just switched away from
  // the admin account inside the portal) → send back to home.
  if (!admin && (path === '/admin' || path === '/manage-merchants')) {
    queueMicrotask(() => navigate('/', { replace: true }));
  }
  void tick;
  return null;
}

export function MobileFrame({ children }: MobileFrameProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="relative w-full max-w-[390px] h-screen bg-white overflow-hidden">
        <AdminRedirectGuard />
        {children}
      </div>
    </div>
  );
}
