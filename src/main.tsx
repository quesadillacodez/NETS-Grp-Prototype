  import { createRoot } from "react-dom/client";
  import App from "./app/App";
  import { StartupSplash } from "./app/components/StartupSplash";
  import "./styles/index.css";
  import { initDatabase, syncDatabaseFilesNow } from "./app/utils/db";
  import { seedDealsIfEmpty, reconcileDealRedemptionCounts } from "./app/utils/dealStorage";
  import { seedMerchantsIfEmpty, ensureFashionMerchants } from "./app/utils/merchantStorage";
  import { getAllUsers, syncAllReminderSettings } from "./app/utils/userStorage";
  import { seedDemoHistoryIfEmpty } from "./app/utils/reminderStorage";
  import { restoreServerSession } from "./app/utils/authStorage";
  import { recordLogin } from "./app/utils/questStorage";
  import { getCurrentUser } from "./app/utils/userStorage";
  import { seedMerchantTradeIfEmpty } from "./app/utils/menuStorage";

  const root = createRoot(document.getElementById("root")!);
  const startupStartedAt = performance.now();
  root.render(<StartupSplash />);

  async function waitForMinimumStartupTime(): Promise<void> {
    const remaining = 1500 - (performance.now() - startupStartedAt);
    if (remaining > 0) await new Promise(resolve => window.setTimeout(resolve, remaining));
  }

  initDatabase()
    .then(async () => {
      // Restore the HttpOnly server session and hydrate the newest synchronized
      // database before rendering any private screen.
      await restoreServerSession();

      // Ensure the public user/contact rows exist before any seeded reminder or
      // relationship can reference them. Credentials are never stored here.
      getAllUsers();

      // Reference catalogues only (the deals shown in Rewards). No fabricated
      // user activity is seeded — reminders, transactions and goals are created
      // solely by using the app.
      seedDealsIfEmpty();
      reconcileDealRedemptionCounts();

      // Seed the merchant catalogue (all defaults on a fresh DB), then back-fill
      // the fashion merchants into any DB seeded before they were added.
      seedMerchantsIfEmpty();
      ensureFashionMerchants();
      seedMerchantTradeIfEmpty();

      // Populate the reminder_settings table for every user so it's viewable
      // in the database from the start.
      syncAllReminderSettings();

      // Seed one paid Alex→Sarah bill so Sarah shows a "usually pays" history in the demo.
      seedDemoHistoryIfEmpty();

      // Write the on-disk database files once at startup so /database reflects
      // the current data immediately (then keeps updating on every change).
      syncDatabaseFilesNow();

      // Completes the daily check-in mission for whoever is signed in.
      try { recordLogin(getCurrentUser().id); } catch { /* nobody signed in yet */ }

      window.dispatchEvent(new CustomEvent("databaseReady"));

      await waitForMinimumStartupTime();
      root.render(<App />);
    })
    .catch((err) => {
      console.error("Failed to start database:", err);
      root.render(<App />);
    });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      // The build id makes each release its own service worker registration and
      // its own cache, so the previous build's app shell is pruned rather than
      // outliving the chunks it names.
      void navigator.serviceWorker
        .register(`/sw.js?v=${__BUILD_ID__}`, { scope: '/' })
        .catch((error) => {
          console.warn('Offline support could not be registered:', error);
        });
    });
  }
