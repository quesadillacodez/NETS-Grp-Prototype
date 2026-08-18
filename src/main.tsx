  import { createRoot } from "react-dom/client";
  import App from "./app/App";
  import "./styles/index.css";
  import { initDatabase } from "./app/utils/db";
  import { seedTestReminders, seedTransactions, seedHistoricalTransactions } from "./app/utils/seedTestData";
  import { seedDealsIfEmpty, reconcileDealRedemptionCounts } from "./app/utils/dealStorage";

  initDatabase()
    .then(() => {
      seedTestReminders();
      seedDealsIfEmpty();
      seedTransactions();
      seedHistoricalTransactions();
      reconcileDealRedemptionCounts();

      window.dispatchEvent(new CustomEvent("databaseReady"));

      createRoot(document.getElementById("root")!).render(<App />);
    })
    .catch((err) => {
      console.error("Failed to start database:", err);
      createRoot(document.getElementById("root")!).render(<App />);
    });
