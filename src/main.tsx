  import { createRoot } from "react-dom/client";
  import App from "./app/App";
  import "./styles/index.css";
  import { initDatabase } from "./app/utils/db";
  import { seedTestReminders, seedTransactions, seedHistoricalTransactions } from "./app/utils/seedTestData";
  import { seedDealsIfEmpty, reconcileDealRedemptionCounts } from "./app/utils/dealStorage";
  import { recordLogin } from "./app/utils/questStorage";
  import { getCurrentUser } from "./app/utils/userStorage";

  initDatabase()
    .then(() => {
      seedTestReminders();
      seedDealsIfEmpty();
      seedTransactions();
      seedHistoricalTransactions();
      reconcileDealRedemptionCounts();

      // Completes the daily check-in mission for whoever is signed in.
      try { recordLogin(getCurrentUser().id); } catch { /* no user yet */ }

      window.dispatchEvent(new CustomEvent("databaseReady"));

      createRoot(document.getElementById("root")!).render(<App />);
    })
    .catch((err) => {
      console.error("Failed to start database:", err);
      createRoot(document.getElementById("root")!).render(<App />);
    });
