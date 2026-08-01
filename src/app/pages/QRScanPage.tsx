import { useState, useEffect, useRef } from 'react';
import { X, ScanLine, Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { addTransaction, formatDateForTransaction } from '../utils/transactionStorage';
import { getCurrentUser } from '../utils/userStorage';
import {
  requestNetsQr,
  watchWebhook,
  isScanned,
  isPaymentSuccess,
  type NetsQrRequestResult,
} from '../utils/netsQr';
import { getMerchants, type Merchant } from '../utils/merchantStorage';
import { useAppEvents } from '../utils/useAppEvents';
import { createPaymentId, type PaymentFlowContext } from '../utils/paymentFlow';

interface ScanState extends Partial<PaymentFlowContext> {
  amount?: number;
  merchantName?: string;
  reference?: string;
}

const NETS_TIMEOUT_SECONDS = 300;

export function QRScanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = (location.state as ScanState | null) ?? null;

  const [paymentId] = useState(() => incoming?.paymentId ?? createPaymentId());
  const [amount, setAmount] = useState(() => incoming?.amount?.toFixed(2) ?? '');
  const [merchantName, setMerchantName] = useState(() => incoming?.merchantName ?? '');
  const [reference, setReference] = useState(() => incoming?.reference ?? '');

  const [merchants, setMerchants] = useState<Merchant[]>([]);

  useAppEvents(['merchantsUpdated'], () => setMerchants(getMerchants()));

  const [isGenerating, setIsGenerating] = useState(false);
  const [qr, setQr] = useState<NetsQrRequestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(NETS_TIMEOUT_SECONDS);

  const [generatedAmount, setGeneratedAmount] = useState(0);
  const [generatedMerchant, setGeneratedMerchant] = useState('');

  const [showPopup, setShowPopup] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webhookRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      webhookRef.current?.cancel();
    };
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSecondsLeft(NETS_TIMEOUT_SECONDS);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const stopEverything = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    webhookRef.current?.cancel();
    webhookRef.current = null;
  };

  const timerText = () => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const applyPreset = (preset: Merchant) => {
    setError(null);
    setAmount(preset.amount.toFixed(2));
    setMerchantName(preset.name);
    setReference(preset.reference ?? '');
  };

  const simulateScan = () => {
    if (incoming?.hangoutId && amount && merchantName) {
      handleGenerate(parseFloat(amount), merchantName, reference);
      return;
    }
    const list = merchants.length ? merchants : getMerchants();
    if (list.length === 0) {
      setError('No merchants available to scan.');
      return;
    }
    const preset = list[Math.floor(Math.random() * list.length)];
    applyPreset(preset);
    handleGenerate(preset.amount, preset.name, preset.reference ?? '');
  };

  const handleGenerate = async (
    amountArg?: number,
    merchantArg?: string,
    referenceArg?: string
  ) => {
    setError(null);

    const parsedAmount = amountArg ?? parseFloat(amount);
    const merchant = (merchantArg ?? merchantName).trim();
    const ref = referenceArg ?? reference;

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!merchant) {
      setError('Please enter a merchant name.');
      return;
    }

    setIsGenerating(true);
    setQr(null);

    try {
      const result = await requestNetsQr(parsedAmount, undefined, 0, ref);
      setQr(result);
      setGeneratedAmount(parsedAmount);
      setGeneratedMerchant(merchant);
      startTimer();

      const watcher = watchWebhook(result.retrievalRef);
      webhookRef.current = watcher;
      watcher.result
        .then((webhook) => {
          if (isScanned(webhook) && isPaymentSuccess(webhook)) {
            stopEverything();
            setShowPopup(true);
          }
        })
        .catch(() => {
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmPayment = () => {
    stopEverything();
    setShowPopup(true);
  };

  const handleCancel = () => {
    stopEverything();
    resetForm();
  };

  const resetForm = () => {
    stopEverything();
    setQr(null);
    setError(null);
    setGeneratedAmount(0);
    setGeneratedMerchant('');
    setSecondsLeft(NETS_TIMEOUT_SECONDS);
  };

  return (
    <div className="flex flex-col h-full bg-foreground">
      <div className="absolute top-0 left-0 right-0 z-10 px-6 pt-12 pb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              stopEverything();
              navigate('/');
            }}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white font-semibold">Scan to Pay</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-28 pb-8">
        {!qr ? (
          <div className="flex flex-col items-center text-center justify-center min-h-full">
            <div className="w-32 h-32 rounded-[2rem] bg-white/10 border border-white/20 flex items-center justify-center mb-8">
              <ScanLine className="w-16 h-16 text-white" />
            </div>

            <h2 className="text-white text-2xl font-bold mb-3">Ready to scan</h2>
            <p className="text-white/60 text-sm mb-10 max-w-xs leading-relaxed">
              {incoming?.hangoutId
                ? 'Your confirmed Hangout is ready. Generate the payment using its estimated group total.'
                : "Point at a merchant's NETS QR to pay. The amount and merchant details come through automatically."}
            </p>

            {incoming?.hangoutId && (
              <div className="mb-5 w-full rounded-2xl border border-white/20 bg-white/10 p-4 text-left text-white">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">Confirmed plan estimate</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{merchantName}</p>
                    {reference && <p className="mt-1 truncate text-xs text-white/60">{reference}</p>}
                  </div>
                  <p className="shrink-0 text-2xl font-black">${Number(amount).toFixed(2)}</p>
                </div>
                <p className="mt-2 text-[10px] text-white/55">Final merchant amount can still be confirmed at payment.</p>
              </div>
            )}

            {error && (
              <p className="w-full text-sm text-red-300 bg-red-500/10 border border-red-400/30 rounded-xl px-4 py-3 mb-4">
                {error}
              </p>
            )}

            <button
              onClick={simulateScan}
              disabled={isGenerating}
              className="w-full py-5 bg-white rounded-2xl font-semibold text-foreground shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Scanning…
                </>
              ) : (
                <>
                  <ScanLine className="w-5 h-5" />
                  {incoming?.hangoutId ? 'Continue with Hangout' : 'Scan'}
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="bg-white rounded-3xl p-6 shadow-lg mb-4">
              <img
                src={`data:image/png;base64,${qr.qrCodeBase64}`}
                alt="NETS QR Code"
                className="w-64 h-64 object-contain"
              />
            </div>

            <p className="text-white text-lg font-bold mb-3">{timerText()}</p>

            <p className="text-white text-2xl font-bold mb-1">${generatedAmount.toFixed(2)}</p>
            <p className="text-white/70 mb-1">{generatedMerchant}</p>
            {reference.trim() ? (
              <p className="text-white/50 text-sm mb-6">Ref: {reference.trim()}</p>
            ) : (
              <div className="mb-6" />
            )}

            <p className="text-white/60 text-sm mb-6">
              Scan this NETS QR to pay the merchant, or confirm below once done.
            </p>

            <div className="w-full space-y-3">
              <button
                onClick={handleConfirmPayment}
                className="w-full py-4 bg-white rounded-2xl font-semibold text-foreground shadow-lg"
              >
                I've Paid
              </button>
              <button
                onClick={handleCancel}
                className="w-full py-4 bg-red-600 text-white rounded-2xl font-semibold shadow-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary mx-auto mb-4 flex items-center justify-center">
                  <ScanLine className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Payment Complete</h2>
                <p className="text-4xl font-bold text-primary mb-1">${generatedAmount.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">to {generatedMerchant}</p>
              </div>

              <p className="text-center text-foreground mb-6">Would you like to split this payment?</p>

              <div className="space-y-3">
                <button
                  onClick={() =>
                    navigate('/split-setup', {
                      state: {
                        amount: generatedAmount,
                        merchantName: generatedMerchant,
                        paymentId,
                        hangoutId: incoming?.hangoutId,
                        participantUserIds: incoming?.participantUserIds,
                        reference: incoming?.reference,
                      },
                    })
                  }
                  className="w-full py-4 bg-primary text-white rounded-2xl font-semibold shadow-sm"
                >
                  Split Bill
                </button>
                <button
                  onClick={() => {
                    addTransaction(
                      {
                        name: generatedMerchant,
                        amount: -generatedAmount,
                        date: formatDateForTransaction(),
                        category: 'Food & Beverage',
                        kind: 'purchase',
                        paymentId,
                      },
                      getCurrentUser().id
                    );
                    navigate('/');
                  }}
                  className="w-full py-4 bg-secondary text-foreground rounded-2xl font-semibold border border-border"
                >
                  Pay Full Amount
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
