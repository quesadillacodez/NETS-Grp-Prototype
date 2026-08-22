import { useState, useEffect, useRef } from 'react';
import { X, ScanLine, Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { addTransaction, formatDateForTransaction } from '../utils/transactionStorage';
import { getCurrentUser, getAllUsers } from '../utils/userStorage';
import {
  requestNetsQr,
  watchWebhook,
  isScanned,
  isPaymentSuccess,
  type NetsQrRequestResult,
} from '../utils/netsQr';
import { getMerchants, type Merchant } from '../utils/merchantStorage';
import { getSellableMenu, recordItemSale, type MenuItem } from '../utils/menuStorage';
import { payHangout } from '../utils/hangoutStorage';
import { useAppEvents } from '../utils/useAppEvents';
import { createPaymentId, resolvePaymentCategory, type PaymentFlowContext } from '../utils/paymentFlow';
import { recordMerchantSale } from '../utils/merchantInsightStorage';

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

  // A payment id identifies one payment, and the screens after this one treat it
  // as such: the receipt refuses to record a payment whose id it has already
  // seen. It is therefore minted here, once per payment put up for
  // confirmation, and never inherited from navigation state — returning to this
  // screen from the split flow (its back arrow pushes /scan carrying the state)
  // used to hand the next payment the id of one already recorded, and that
  // payment was then dropped in silence.
  const [paymentId, setPaymentId] = useState(createPaymentId);
  const [amount, setAmount] = useState(() => incoming?.amount?.toFixed(2) ?? '');
  const [merchantName, setMerchantName] = useState(() => incoming?.merchantName ?? '');
  const [reference, setReference] = useState(() => incoming?.reference ?? '');

  const [merchants, setMerchants] = useState<Merchant[]>(() => getMerchants());

  useAppEvents(['merchantsUpdated'], () => setMerchants(getMerchants()));

  const [isGenerating, setIsGenerating] = useState(false);
  const [qr, setQr] = useState<NetsQrRequestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(NETS_TIMEOUT_SECONDS);

  const [generatedAmount, setGeneratedAmount] = useState(0);
  const [generatedMerchant, setGeneratedMerchant] = useState('');

  // When the merchant keeps a menu, the customer says what they bought. That is
  // what turns "$6.80 at Kopitiam" into "one Nasi Lemak" on the stall's own
  // dashboard. Merchants with no menu are unaffected.
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [chosenItem, setChosenItem] = useState<MenuItem | null>(null);
  const menu = selectedMerchantId ? getSellableMenu(selectedMerchantId) : [];

  /** Record what the payment was for, once the payment itself is written. */
  const recordItemIfChosen = () => {
    if (!chosenItem || !selectedMerchantId) return;
    recordItemSale({
      paymentId,
      merchantId: selectedMerchantId,
      item: chosenItem,
      userId: getCurrentUser().id,
    });
  };

  const [showPopup, setShowPopup] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webhookRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      webhookRef.current?.cancel();
    };
  }, []);

  // Arriving from a hangout "Pay": there's nothing to scan (the activity cost is
  // already known), so go straight to the same "Payment Complete -> split?"
  // choice the scanner shows after a scan.
  useEffect(() => {
    if (incoming?.hangoutId != null && incoming?.amount != null) {
      setGeneratedAmount(incoming.amount);
      setGeneratedMerchant(incoming.merchantName ?? '');
      setShowPopup(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSelectedMerchantId(preset.id);
    setChosenItem(null);
  };

  /** Picking a dish sets the amount to its price. */
  const chooseItem = (item: MenuItem) => {
    setChosenItem(item);
    setAmount(item.price.toFixed(2));
    setReference(item.name);
    setError(null);
  };

  const simulateScan = () => {
    if (incoming?.hangoutId && amount && merchantName) {
      handleGenerate(parseFloat(amount), merchantName, reference);
      return;
    }
    // A stall picked by hand — with a dish, where the stall keeps a menu — is an
    // explicit choice. Randomising over it would throw that choice away.
    if (selectedMerchantId && merchantName && amount) {
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
    setPaymentId(createPaymentId());

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
    } catch {
      // The live NETS sandbox needs real credentials and a backend proxy, which
      // aren't available in this prototype (that's what caused the "Unauthorized"
      // message). Instead of blocking the demo, complete the payment in
      // simulation mode: show the "Payment Complete" screen with this amount and
      // merchant so the split / pay-full flow can carry on as normal.
      stopEverything();
      setGeneratedAmount(parsedAmount);
      setGeneratedMerchant(merchant);
      setShowPopup(true);
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

            {!incoming?.hangoutId && merchants.length > 0 && (
              <div className="mb-5 w-full text-left">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/55">
                  Or pick a stall to pay
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {merchants.map(entry => (
                    <button
                      key={entry.id}
                      onClick={() => applyPreset(entry)}
                      aria-pressed={selectedMerchantId === entry.id}
                      className={`min-h-11 rounded-xl px-3 text-xs font-bold ${selectedMerchantId === entry.id ? 'bg-white text-foreground' : 'bg-white/10 text-white'}`}
                    >
                      {entry.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {menu.length > 0 && !incoming?.hangoutId && (
              <div className="mb-5 w-full rounded-2xl border border-white/20 bg-white/10 p-4 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">
                  What are you buying at {merchantName}?
                </p>
                <div className="mt-2 grid gap-1.5">
                  {menu.map(item => (
                    <button
                      key={item.id}
                      onClick={() => chooseItem(item)}
                      aria-pressed={chosenItem?.id === item.id}
                      className={`flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-left text-xs font-bold ${chosenItem?.id === item.id ? 'bg-white text-foreground' : 'bg-white/10 text-white'}`}
                    >
                      <span className="min-w-0 truncate">{item.name}</span>
                      <span className="flex-shrink-0">${item.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-white/55">
                  Telling the stall what you bought is what lets them see which dishes sell.
                </p>
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
                  onClick={() => {
                    // Hangout: participants are the invited friends, so skip the
                    // Select Contacts step and go straight to the custom split
                    // (same customisable-amount screen the scanner uses).
                    if (incoming?.participantUserIds && incoming.participantUserIds.length > 0) {
                      const meId = getCurrentUser().id;
                      const allUsers = getAllUsers();
                      const selectedContacts = incoming.participantUserIds
                        .filter(id => id !== meId)
                        .map(id => {
                          const u = allUsers.find(user => user.id === id);
                          return { id, name: u?.name ?? 'Friend', avatar: u?.avatar ?? '👤' };
                        });
                      navigate('/custom-split', {
                        state: {
                          amount: generatedAmount,
                          merchantName: generatedMerchant,
                          paymentId,
                          paxCount: selectedContacts.length + 1,
                          selectedContacts,
                          hangoutId: incoming.hangoutId,
                          reference: incoming.reference,
                          spendCategory: incoming.spendCategory,
                        },
                      });
                      return;
                    }
                    navigate('/split-setup', {
                      state: {
                        amount: generatedAmount,
                        merchantName: generatedMerchant,
                        paymentId,
                        hangoutId: incoming?.hangoutId,
                        participantUserIds: incoming?.participantUserIds,
                        reference: incoming?.reference,
                        spendCategory: incoming?.spendCategory,
                      },
                    });
                  }}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-semibold shadow-sm"
                >
                  Split Bill
                </button>
                <button
                  onClick={() => {
                    const currentUser = getCurrentUser();
                    addTransaction(
                      {
                        name: generatedMerchant,
                        amount: -generatedAmount,
                        date: formatDateForTransaction(),
                        category: resolvePaymentCategory(generatedMerchant, incoming ?? undefined),
                        kind: 'purchase',
                        paymentId,
                      },
                      currentUser.id
                    );
                    recordMerchantSale({
                      merchantName: generatedMerchant,
                      itemName: reference || incoming?.reference,
                      amount: generatedAmount,
                      userId: currentUser.id,
                      paymentId,
                    });
                    // If this payment was for a hangout activity, mark it paid so
                    // it can't be paid again and shows its ticket next time.
                    recordItemIfChosen();
                    if (incoming?.hangoutId != null) payHangout(incoming.hangoutId);
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
