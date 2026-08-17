import { lazy, Suspense } from 'react';
import type { ComponentType } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router';
import { MotionConfig } from 'motion/react';
import { MobileFrame } from './components/MobileFrame';
import { ErrorBoundary } from './components/ErrorBoundary';

// Routes are code-split with React.lazy so each page's JS is only downloaded when the
// user actually navigates there, instead of one large upfront bundle.
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const QRScanPage = lazy(() => import('./pages/QRScanPage').then(m => ({ default: m.QRScanPage })));
const SplitSetupPage = lazy(() => import('./pages/SplitSetupPage').then(m => ({ default: m.SplitSetupPage })));
const ContactSelectionPage = lazy(() => import('./pages/ContactSelectionPage').then(m => ({ default: m.ContactSelectionPage })));
const BillBreakdownPage = lazy(() => import('./pages/BillBreakdownPage').then(m => ({ default: m.BillBreakdownPage })));
const PaymentSuccessPage = lazy(() => import('./pages/PaymentSuccessPage').then(m => ({ default: m.PaymentSuccessPage })));
const ReminderDashboardPage = lazy(() => import('./pages/ReminderDashboardPage').then(m => ({ default: m.ReminderDashboardPage })));
const ScheduleReminderPage = lazy(() => import('./pages/ScheduleReminderPage').then(m => ({ default: m.ScheduleReminderPage })));
const ReminderTrackingPage = lazy(() => import('./pages/ReminderTrackingPage').then(m => ({ default: m.ReminderTrackingPage })));
const ReminderSettingsPage = lazy(() => import('./pages/ReminderSettingsPage').then(m => ({ default: m.ReminderSettingsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const AllTransactionsPage = lazy(() => import('./pages/AllTransactionsPage').then(m => ({ default: m.AllTransactionsPage })));
const PaymentAuthorizationPage = lazy(() => import('./pages/PaymentAuthorizationPage').then(m => ({ default: m.PaymentAuthorizationPage })));
const PaymentCompletePage = lazy(() => import('./pages/PaymentCompletePage').then(m => ({ default: m.PaymentCompletePage })));
const CustomSplitPage = lazy(() => import('./pages/CustomSplitPage').then(m => ({ default: m.CustomSplitPage })));
const SharedBillPage = lazy(() => import('./pages/SharedBillPage').then(m => ({ default: m.SharedBillPage })));
const ManageMerchantsPage = lazy(() => import('./pages/ManageMerchantsPage').then(m => ({ default: m.ManageMerchantsPage })));
const AdminAccessPage = lazy(() => import('./pages/AdminAccessPage').then(m => ({ default: m.AdminAccessPage })));
const HangoutsPage = lazy(() => import('./pages/HangoutsPage').then(m => ({ default: m.HangoutsPage })));
const RewardsPage = lazy(() => import('./pages/RewardsPage').then(m => ({ default: m.RewardsPage })));
const WrappedPage = lazy(() => import('./pages/WrappedPage').then(m => ({ default: m.WrappedPage })));
const WrappedComparePage = lazy(() => import('./pages/WrappedComparePage').then(m => ({ default: m.WrappedComparePage })));
const SpendingDashboardPage = lazy(() => import('./pages/SpendingDashboardPage').then(m => ({ default: m.SpendingDashboardPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const PinRecoveryPage = lazy(() => import('./pages/PinRecoveryPage').then(m => ({ default: m.PinRecoveryPage })));
const TopUpPage = lazy(() => import('./pages/TopUpPage').then(m => ({ default: m.TopUpPage })));
const TransactionDetailPage = lazy(() => import('./pages/TransactionDetailPage').then(m => ({ default: m.TransactionDetailPage })));
const NotificationCentrePage = lazy(() => import('./pages/NotificationCentrePage').then(m => ({ default: m.NotificationCentrePage })));
const NotificationPreferencesPage = lazy(() => import('./pages/NotificationPreferencesPage').then(m => ({ default: m.NotificationPreferencesPage })));
const PersonalInformationPage = lazy(() => import('./pages/PersonalInformationPage').then(m => ({ default: m.PersonalInformationPage })));
const PaymentMethodsPage = lazy(() => import('./pages/PaymentMethodsPage').then(m => ({ default: m.PaymentMethodsPage })));
const SecurityPrivacyPage = lazy(() => import('./pages/SecurityPrivacyPage').then(m => ({ default: m.SecurityPrivacyPage })));
const HelpSupportPage = lazy(() => import('./pages/HelpSupportPage').then(m => ({ default: m.HelpSupportPage })));
const MerchantPortalPage = lazy(() => import('./pages/MerchantPortalPage').then(m => ({ default: m.MerchantPortalPage })));
const DemoControlsPage = lazy(() => import('./pages/DemoControlsPage').then(m => ({ default: m.DemoControlsPage })));

import './utils/autoReminderScheduler';

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
  { path: '/wrapped', Page: WrappedPage },
  { path: '/wrapped/compare', Page: WrappedComparePage },
  { path: '/dashboard', Page: SpendingDashboardPage },
  { path: '/admin', Page: AdminAccessPage },
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
