  import { createRoot } from "react-dom/client";
  import App from "./app/App";
  import "./styles/index.css";
  import { initDatabase, syncDatabaseFilesNow } from "./app/utils/db";
  import { seedDealsIfEmpty, reconcileDealRedemptionCounts } from "./app/utils/dealStorage";
  import { seedMerchantsIfEmpty, ensureFashionMerchants } from "./app/utils/merchantStorage";
  import { syncAllReminderSettings } from "./app/utils/userStorage";
  import { seedDemoHistoryIfEmpty } from "./app/utils/reminderStorage";
  import { logout } from "./app/utils/authStorage";

  // Always start on the login screen on a fresh page load / run, even if a
  // previous session (e.g. the admin account) was remembered. Clearing the
  // stored session here means the app opens on "Sign in to NETS" every time;
  // navigating within the app after signing in still works normally.
  logout();

  initDatabase()
    .then(() => {
      // Reference catalogues only (the deals shown in Rewards). No fabricated
      // user activity is seeded — reminders, transactions and goals are created
      // solely by using the app.
      seedDealsIfEmpty();
      reconcileDealRedemptionCounts();

      // Seed the merchant catalogue (all defaults on a fresh DB), then back-fill
      // the fashion merchants into any DB seeded before they were added.
      seedMerchantsIfEmpty();
      ensureFashionMerchants();

      // Populate the reminder_settings table for every user so it's viewable
      // in the database from the start.
      syncAllReminderSettings();

      // Seed one paid Alex→Sarah bill so Sarah shows a "usually pays" history in the demo.
      seedDemoHistoryIfEmpty();

      // Write the on-disk database files once at startup so /database reflects
      // the current data immediately (then keeps updating on every change).
      syncDatabaseFilesNow();

      window.dispatchEvent(new CustomEvent("databaseReady"));

      createRoot(document.getElementById("root")!).render(<App />);
    })
    .catch((err) => {
      console.error("Failed to start database:", err);
      createRoot(document.getElementById("root")!).render(<App />);
    });
