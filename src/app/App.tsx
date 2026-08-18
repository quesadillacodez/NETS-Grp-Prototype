import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { MotionConfig } from 'motion/react';
import { MobileFrame } from './components/MobileFrame';
import { ErrorBoundary } from './components/ErrorBoundary';

/**
 * A code-split page that survives a deployment.
 *
 * Chunk filenames carry a content hash, so a tab open across a release asks for
 * a file the server no longer has and the import rejects with "Failed to fetch
 * dynamically imported module". Retrying that request is pointless — the file is
 * gone — so reload once instead, which fetches the current index.html and with
 * it the chunk names that exist now.
 *
 * The reload is stamped in sessionStorage and only repeats after a minute, so a
 * chunk that is genuinely broken shows the error screen rather than putting the
 * page into a reload loop.
 */
const RELOAD_KEY = 'nets:chunk-reload-at';

function lazyPage<T extends ComponentType>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((error: unknown) => {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      if (Date.now() - last < 60_000) throw error;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
      // The reload takes over; nothing should render in the meantime.
      return new Promise<{ default: T }>(() => {});
    }),
  );
}

// Routes are code-split so each page's JS is only downloaded when the
// user actually navigates there, instead of one large upfront bundle.
const HomePage = lazyPage(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const QRScanPage = lazyPage(() => import('./pages/QRScanPage').then(m => ({ default: m.QRScanPage })));
const SplitSetupPage = lazyPage(() => import('./pages/SplitSetupPage').then(m => ({ default: m.SplitSetupPage })));
const ContactSelectionPage = lazyPage(() => import('./pages/ContactSelectionPage').then(m => ({ default: m.ContactSelectionPage })));
const BillBreakdownPage = lazyPage(() => import('./pages/BillBreakdownPage').then(m => ({ default: m.BillBreakdownPage })));
const PaymentSuccessPage = lazyPage(() => import('./pages/PaymentSuccessPage').then(m => ({ default: m.PaymentSuccessPage })));
const ReminderDashboardPage = lazyPage(() => import('./pages/ReminderDashboardPage').then(m => ({ default: m.ReminderDashboardPage })));
const ScheduleReminderPage = lazyPage(() => import('./pages/ScheduleReminderPage').then(m => ({ default: m.ScheduleReminderPage })));
const ReminderTrackingPage = lazyPage(() => import('./pages/ReminderTrackingPage').then(m => ({ default: m.ReminderTrackingPage })));
const ReminderSettingsPage = lazyPage(() => import('./pages/ReminderSettingsPage').then(m => ({ default: m.ReminderSettingsPage })));
const ProfilePage = lazyPage(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const AllTransactionsPage = lazyPage(() => import('./pages/AllTransactionsPage').then(m => ({ default: m.AllTransactionsPage })));
const PaymentAuthorizationPage = lazyPage(() => import('./pages/PaymentAuthorizationPage').then(m => ({ default: m.PaymentAuthorizationPage })));
const PaymentCompletePage = lazyPage(() => import('./pages/PaymentCompletePage').then(m => ({ default: m.PaymentCompletePage })));
const CustomSplitPage = lazyPage(() => import('./pages/CustomSplitPage').then(m => ({ default: m.CustomSplitPage })));
const SharedBillPage = lazyPage(() => import('./pages/SharedBillPage').then(m => ({ default: m.SharedBillPage })));
const ManageMerchantsPage = lazyPage(() => import('./pages/ManageMerchantsPage').then(m => ({ default: m.ManageMerchantsPage })));
const AdminAccessPage = lazyPage(() => import('./pages/AdminAccessPage').then(m => ({ default: m.AdminAccessPage })));
const HangoutsPage = lazyPage(() => import('./pages/HangoutsPage').then(m => ({ default: m.HangoutsPage })));
const RewardsPage = lazyPage(() => import('./pages/RewardsPage').then(m => ({ default: m.RewardsPage })));
const XPBreakdownPage = lazyPage(() => import('./pages/XPBreakdownPage').then(m => ({ default: m.XPBreakdownPage })));
const QuestsPage = lazyPage(() => import('./pages/QuestsPage').then(m => ({ default: m.QuestsPage })));
const MerchantAnalyticsPage = lazyPage(() => import('./pages/MerchantAnalyticsPage').then(m => ({ default: m.MerchantAnalyticsPage })));
const WrappedPage = lazyPage(() => import('./pages/WrappedPage').then(m => ({ default: m.WrappedPage })));
const WrappedComparePage = lazyPage(() => import('./pages/WrappedComparePage').then(m => ({ default: m.WrappedComparePage })));
const SpendingDashboardPage = lazyPage(() => import('./pages/SpendingDashboardPage').then(m => ({ default: m.SpendingDashboardPage })));
const LoginPage = lazyPage(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const PinRecoveryPage = lazyPage(() => import('./pages/PinRecoveryPage').then(m => ({ default: m.PinRecoveryPage })));
const TopUpPage = lazyPage(() => import('./pages/TopUpPage').then(m => ({ default: m.TopUpPage })));
const TransactionDetailPage = lazyPage(() => import('./pages/TransactionDetailPage').then(m => ({ default: m.TransactionDetailPage })));
const NotificationCentrePage = lazyPage(() => import('./pages/NotificationCentrePage').then(m => ({ default: m.NotificationCentrePage })));
const NotificationPreferencesPage = lazyPage(() => import('./pages/NotificationPreferencesPage').then(m => ({ default: m.NotificationPreferencesPage })));
const PersonalInformationPage = lazyPage(() => import('./pages/PersonalInformationPage').then(m => ({ default: m.PersonalInformationPage })));
const PaymentMethodsPage = lazyPage(() => import('./pages/PaymentMethodsPage').then(m => ({ default: m.PaymentMethodsPage })));
const SecurityPrivacyPage = lazyPage(() => import('./pages/SecurityPrivacyPage').then(m => ({ default: m.SecurityPrivacyPage })));
const HelpSupportPage = lazyPage(() => import('./pages/HelpSupportPage').then(m => ({ default: m.HelpSupportPage })));
const MerchantPortalPage = lazyPage(() => import('./pages/MerchantPortalPage').then(m => ({ default: m.MerchantPortalPage })));
const DemoControlsPage = lazyPage(() => import('./pages/DemoControlsPage').then(m => ({ default: m.DemoControlsPage })));
const DatabaseExplorerPage = lazyPage(() => import('./pages/DatabaseExplorerPage').then(m => ({ default: m.DatabaseExplorerPage })));

import './utils/autoReminderScheduler';
import './utils/voucherExpiryScheduler';

const routes: { path: string; Page: ComponentType }[] = [
  { path: '/', Page: HomePage },
  { path: '/top-up', Page: TopUpPage },
  { path: '/scan', Page: QRScanPage },
  { path: '/split-setup', Page: SplitSetupPage },
  { path: '/select-contacts', Page: ContactSelectionPage },
  { path: '/bill-breakdown', Page: BillBreakdownPage },
  { path: '/payment-success', Page: PaymentSuccessPage },
  { path: '/reminders', Page: ReminderDashboardPage },
  { path: '/schedule-reminder', Page: ScheduleReminderPage },
  { path: '/reminder-tracking', Page: ReminderTrackingPage },
  { path: '/reminder-settings', Page: ReminderSettingsPage },
  { path: '/profile', Page: ProfilePage },
  { path: '/profile/personal', Page: PersonalInformationPage },
  { path: '/profile/payment-methods', Page: PaymentMethodsPage },
  { path: '/profile/notification-preferences', Page: NotificationPreferencesPage },
  { path: '/profile/security', Page: SecurityPrivacyPage },
  { path: '/profile/help', Page: HelpSupportPage },
  { path: '/profile/demo', Page: DemoControlsPage },
  { path: '/notifications', Page: NotificationCentrePage },
  { path: '/all-transactions', Page: AllTransactionsPage },
  { path: '/transaction/:id', Page: TransactionDetailPage },
  { path: '/payment-authorization', Page: PaymentAuthorizationPage },
  { path: '/payment-complete', Page: PaymentCompletePage },
  { path: '/custom-split', Page: CustomSplitPage },
  { path: '/shared-bill', Page: SharedBillPage },
  { path: '/manage-merchants', Page: ManageMerchantsPage },
  { path: '/hangouts', Page: HangoutsPage },
  { path: '/deals', Page: HangoutsPage },
  { path: '/rewards', Page: RewardsPage },
  { path: '/xp-breakdown', Page: XPBreakdownPage },
  { path: '/quests', Page: QuestsPage },
  { path: '/merchant-analytics', Page: MerchantAnalyticsPage },
  { path: '/wrapped', Page: WrappedPage },
  { path: '/wrapped/compare', Page: WrappedComparePage },
  { path: '/dashboard', Page: SpendingDashboardPage },
  { path: '/admin', Page: AdminAccessPage },
  { path: '/database', Page: DatabaseExplorerPage },
  { path: '/merchant', Page: MerchantPortalPage },
];

function PageLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <MobileFrame requiresAuth={false}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <LoginPage />
          </Suspense>
        </ErrorBoundary>
      </MobileFrame>
    ),
  },
  {
    path: '/recover-pin',
    element: (
      <MobileFrame requiresAuth={false}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <PinRecoveryPage />
          </Suspense>
        </ErrorBoundary>
      </MobileFrame>
    ),
  },
  ...routes.map(({ path, Page }) => ({
    path,
    element: (
      <MobileFrame>
        <ErrorBoundary>
          <Suspense fallback={<PageLoading />}>
            <Page />
          </Suspense>
        </ErrorBoundary>
      </MobileFrame>
    ),
  })),
  { path: '/split', element: <Navigate to="/scan" replace /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  // `reducedMotion="user"` makes every Framer Motion animation in the app honour
  // the operating system's reduce-motion setting, without each page opting in.
  return (
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  );
}
