// NOTE: These sandbox credentials are read from environment variables (see .env /
// .env.example) instead of being hardcoded, so they aren't committed to source control.
// This is still a *client-side* key, which is acceptable for a NETS Sandbox demo/prototype
// but would need to move behind a backend proxy for a production deployment, since anything
// shipped to the browser is technically visible to users. See friendlyError() below, which
// already anticipates this by suggesting a backend proxy for CORS/network issues.
const NETS_BASE_URL = import.meta.env.VITE_NETS_BASE_URL || 'https://sandbox.nets.openapipaas.com/api/v1';
const NETS_API_KEY = import.meta.env.VITE_NETS_API_KEY || '';
const NETS_PROJECT_ID = import.meta.env.VITE_NETS_PROJECT_ID || '';

export const NETS_TXN_ID = import.meta.env.VITE_NETS_TXN_ID || 'sandbox_nets|m|66d76d08-1a3d-4992-8768-a1c8db8ba1fa';

if (!NETS_API_KEY || !NETS_PROJECT_ID) {
  console.warn(
    'NETS sandbox credentials are missing. Copy .env.example to .env and fill in VITE_NETS_API_KEY / VITE_NETS_PROJECT_ID.'
  );
}

const jsonHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  'api-key': NETS_API_KEY,
  'project-id': NETS_PROJECT_ID,
};

export interface NetsQrRequestResult {
  txnId: number;
  retrievalRef: string;
  amount: number;
  qrCodeBase64: string;
  networkCode: number;
  instruction: string;
  responseCode: string;
}

export interface NetsQrWebhookResult {
  message: string;
  responseCode: string;
}

export interface NetsQrQueryResult {
  txnId: number;
  retrievalRef: string;
  responseCode: string;
  txnStatus: number;
}

async function handleResponse(res: Response): Promise<any> {
  if (res.ok) return res.json();
  let message = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    message = body?.result?.message || message;
  } catch {
  }
  throw new Error(message);
}

function friendlyError(err: unknown): Error {
  const message = err instanceof Error ? err.message : 'Something went wrong.';
  if (message === 'Failed to fetch') {
    return new Error(
      'Could not reach the NETS sandbox (likely a CORS/network block from the browser). A backend proxy is needed to forward this call.'
    );
  }
  return new Error(message);
}

export async function requestNetsQr(
  amount: number,
  txnId: string = NETS_TXN_ID,
  notifyMobile = 0,
  reference?: string
): Promise<NetsQrRequestResult> {
  try {
    const res = await fetch(`${NETS_BASE_URL}/common/payments/nets-qr/request`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        amt_in_dollars: amount,
        txn_id: txnId,
        notify_mobile: notifyMobile,
        reference: reference?.trim() || undefined,
      }),
    });

    const json = await handleResponse(res);
    const data = json?.result?.data ?? json?.result ?? json?.data ?? json;

    if (!data?.qr_code) {
      throw new Error('QR code not found in the response.');
    }

    return {
      txnId: data.txn_nets_qr_id,
      retrievalRef: data.txn_retrieval_ref,
      amount: data.amt_in_dollars,
      qrCodeBase64: data.qr_code,
      networkCode: data.network_status,
      instruction: data.instruction,
      responseCode: data.response_code,
    };
  } catch (err) {
    throw friendlyError(err);
  }
}

export function watchWebhook(retrievalRef: string, courseInitId = ''): {
  result: Promise<NetsQrWebhookResult>;
  cancel: () => void;
} {
  const controller = new AbortController();
  const courseParam = courseInitId ? `&course_init_id=${courseInitId}` : '';
  const url = `${NETS_BASE_URL}/common/payments/nets/webhook?txn_retrieval_ref=${retrievalRef}${courseParam}`;

  const result = (async (): Promise<NetsQrWebhookResult> => {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          ...jsonHeaders,
          'Content-Type': 'text/event-stream',
          Connection: 'keep-alive',
        },
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Webhook connection failed (HTTP ${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || !line.includes('message')) continue;

          const dataPart = line.includes('data:') ? line.split('data:')[1].trim() : line;
          try {
            const json = JSON.parse(dataPart);
            if (json?.message) {
              return {
                message: json.message as string,
                responseCode: (json.response_code ?? '') as string,
              };
            }
          } catch {
          }
        }
      }

      throw new Error('Webhook stream closed before a result arrived.');
    } catch (err) {
      if (controller.signal.aborted) {
        return { message: 'cancelled', responseCode: '' };
      }
      throw friendlyError(err);
    }
  })();

  return {
    result,
    cancel: () => controller.abort(),
  };
}

export async function queryNetsQr(
  retrievalRef: string,
  frontendTimeoutStatus: number
): Promise<NetsQrQueryResult> {
  try {
    const res = await fetch(`${NETS_BASE_URL}/common/payments/nets-qr/query`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({
        txn_retrieval_ref: retrievalRef,
        frontend_timeout_status: frontendTimeoutStatus,
      }),
    });

    const json = await handleResponse(res);
    const data = json?.result?.data ?? json?.result ?? json?.data ?? json;

    return {
      txnId: data.txn_nets_qr_id,
      retrievalRef: data.txn_retrieval_ref,
      responseCode: data.response_code,
      txnStatus: data.txn_status,
    };
  } catch (err) {
    throw friendlyError(err);
  }
}

export const isScanned = (w: NetsQrWebhookResult) => w.message === 'QR code scanned';
export const isPaymentSuccess = (w: NetsQrWebhookResult) => w.responseCode === '00';
export const isQuerySuccess = (q: NetsQrQueryResult) =>
  q.responseCode === '00' && q.txnStatus === 1;
