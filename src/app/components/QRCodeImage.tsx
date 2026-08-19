import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { LoaderCircle } from 'lucide-react';

export function QRCodeImage({ value, label, muted = false }: {
  value: string;
  label: string;
  muted?: boolean;
}) {
  const [source, setSource] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setSource('');
    setError(false);
    void QRCode.toDataURL(value, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f2c45', light: '#ffffff' },
    }).then(result => {
      if (active) setSource(result);
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [value]);

  return (
    <div className={`mx-auto my-4 grid aspect-square w-52 place-items-center overflow-hidden rounded-3xl border-8 border-[#0f2c45] bg-white p-2 ${muted ? 'opacity-40 grayscale' : ''}`}>
      {source ? (
        <img src={source} alt={label} className="h-full w-full object-contain" />
      ) : error ? (
        <p role="alert" className="px-3 text-center text-xs font-bold text-destructive">QR code unavailable</p>
      ) : (
        <LoaderCircle size={28} className="animate-spin text-primary" aria-label="Generating QR code" />
      )}
    </div>
  );
}
