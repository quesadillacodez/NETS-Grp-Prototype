import { ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getCurrentUser, isAdminUser } from '../utils/userStorage';
import { isLoggedIn } from '../utils/authStorage';
import { useAppEvents } from '../utils/useAppEvents';

interface MobileFrameProps {
  children: ReactNode;
  requiresAuth?: boolean;
}

// Pages an admin IS allowed to stay on. Everything else redirects to /admin.
const ADMIN_ALLOWED = ['/admin', '/manage-merchants'];

function AdminRedirectGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tick, setTick] = useState(0);
  useAppEvents(['userSwitched', 'databaseReady', 'sessionChanged'], () => setTick((t) => t + 1));

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

// Signed-out visitors go to the login screen; only once a session exists does the
// admin/user routing guard get a say, so the two can't fight over a redirect.
function SessionGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tick, setTick] = useState(0);
  useAppEvents(['sessionChanged', 'databaseReady'], () => setTick((t) => t + 1));
  void tick;

  if (!isLoggedIn()) {
    const from = `${location.pathname}${location.search}`;
    queueMicrotask(() => navigate('/login', { replace: true, state: from === '/' ? undefined : { from } }));
    return null;
  }
  return <AdminRedirectGuard />;
}

export function MobileFrame({ children, requiresAuth = true }: MobileFrameProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="relative w-full max-w-[390px] h-screen bg-white overflow-hidden">
        {requiresAuth && <SessionGuard />}
        {children}
      </div>
    </div>
  );
}
