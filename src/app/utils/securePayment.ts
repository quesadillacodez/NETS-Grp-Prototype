/**
 * Simulated authorization layer for in-app peer-to-peer settlements
 * (i.e. a friend paying back a split-bill reminder inside this prototype).
 *
 * IMPORTANT — what this is and isn't:
 * - This is NOT real payment security. There is no encryption, tokenization,
 *   or connection to a payment rail here — it's a local DB write
 *   (`markReminderAsPaid` + `addTransaction`) dressed up with an
 *   authorization code so the flow *feels* like a real authorized
 *   transaction during a demo.
 * - The one part of this app that DOES talk to a real payment system is the
 *   NETS Sandbox QR flow in `netsQr.ts` / `QRScanPage.tsx` (merchant
 *   payment). Peer-to-peer reminder repayment, handled here, is fully local
 *   and simulated.
 * - In a production version, this function is exactly where you'd swap in a
 *   real authorization call (e.g. a signed request to a payments API) before
 *   committing the DB write.
 *
 * Be upfront about this distinction if asked in a review — the code is
 * intentionally documented so you can explain it accurately rather than
 * imply real security exists.
 */
export interface SimulatedAuthorization {
  authRef: string;
  authorizedAt: string;
}

export function createSimulatedAuthorization(): SimulatedAuthorization {
  const random =
    typeof crypto !== 'undefined' && 'getRandomValues' in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(4)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      : Math.random().toString(16).slice(2, 10);

  return {
    authRef: `SIM-AUTH-${random.toUpperCase()}`,
    authorizedAt: new Date().toISOString(),
  };
}
