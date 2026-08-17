import { ReactNode, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { getCurrentUser, roleOf } from '../utils/userStorage';
import { isLoggedIn } from '../utils/authStorage';
import { useAppEvents } from '../utils/useAppEvents';

interface MobileFrameProps {
  children: ReactNode;
  requiresAuth?: boolean;
}

// Each role has a home and the set of pages it may stay on. Anything else
// redirects, so signing in as a merchant can never land on the customer wallet
// and a customer can never reach a portal.
const ROLE_HOME = { admin: '/admin', merchant: '/merchant', customer: '/' } as const;

const ROLE_ALLOWED: Record<keyof typeof ROLE_HOME, string[] | null> = {
  admin: ['/admin', '/manage-merchants', '/database'],
  merchant: ['/merchant'],
  // Customers may go anywhere that is not somebody else's portal.
  customer: null,
};

const PORTAL_PATHS = ['/admin', '/manage-merchants', '/merchant', '/database'];

function RoleRedirectGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tick, setTick] = useState(0);
  useAppEvents(['userSwitched', 'databaseReady', 'sessionChanged'], () => setTick((t) => t + 1));

  const role = roleOf(getCurrentUser());
  const path = location.pathname;
  const allowed = ROLE_ALLOWED[role];

  if (allowed) {
    // A portal account outside its own pages goes back to its portal.
    if (!allowed.includes(path)) queueMicrotask(() => navigate(ROLE_HOME[role], { replace: true }));
  } else if (PORTAL_PATHS.includes(path)) {
    // A customer who ended up on a portal page (e.g. after switching account
    // from inside one) goes home.
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
