import { ReactNode, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getCurrentUser, getUserHomePath, isAdminUser, isMerchantUser } from '../utils/userStorage';
import { isLoggedIn } from '../utils/authStorage';
import { useAppEvents } from '../utils/useAppEvents';

interface MobileFrameProps {
  children: ReactNode;
  requiresAuth?: boolean;
}

// Pages an admin IS allowed to stay on. Everything else redirects to /admin.
const ADMIN_ALLOWED = ['/admin', '/manage-merchants'];

function RoleRedirectGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tick, setTick] = useState(0);
  useAppEvents(['userSwitched', 'databaseReady', 'sessionChanged'], () => setTick((t) => t + 1));

  const user = getCurrentUser();
  const admin = isAdminUser(user);
  const merchant = isMerchantUser(user);
  const path = location.pathname;

  // Admin on a normal user page → send to the portal.
  if (admin && !ADMIN_ALLOWED.includes(path) && path !== '/admin') {
    queueMicrotask(() => navigate('/admin', { replace: true }));
  }
  // Non-admin who ended up on an admin-only page (e.g. just switched away from
  // the admin account inside the portal) → send back to home.
  if (merchant && path !== '/merchant') {
    queueMicrotask(() => navigate('/merchant', { replace: true }));
  }
  if (!admin && !merchant && (path === '/admin' || path === '/manage-merchants' || path === '/merchant')) {
    queueMicrotask(() => navigate(getUserHomePath(user), { replace: true }));
  }
  if (admin && path === '/merchant') {
    queueMicrotask(() => navigate('/admin', { replace: true }));
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
  const wasLoggedIn = useRef(false);
  useAppEvents(['sessionChanged', 'databaseReady'], () => setTick((t) => t + 1));
  void tick;

  if (isLoggedIn()) {
    wasLoggedIn.current = true;
    return <RoleRedirectGuard />;
  }

  // An in-app sign-out (the user WAS authenticated a moment ago, within this
  // same app session) should return to the default home screen, not replay
  // whatever page they signed out from. Only a visit that never authenticated
  // this session preserves the destination, so a deep link (e.g. a Wrapped
  // compare link) still lands where it was headed once the user logs in.
  const from = `${location.pathname}${location.search}`;
  const preserveDestination = !wasLoggedIn.current && from !== '/';
  queueMicrotask(() => navigate('/login', { replace: true, state: preserveDestination ? { from } : undefined }));
  return null;
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
