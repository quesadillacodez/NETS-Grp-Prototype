import { useMemo } from 'react';
import { encodeQr, qrPath } from '../utils/qrCode';

interface Props {
  /** The text the scanner should read — for vouchers, an absolute URL. */
  value: string;
  /** Rendered width and height in pixels. */
  size?: number;
  /** Accessible description; the raw value is rarely useful read aloud. */
  label: string;
  className?: string;
}

/**
 * Renders a real, scannable QR code as a single SVG path.
 *
 * The quiet zone is part of the spec, not padding for looks — scanners need
 * four clear modules around the symbol to lock on, so it is baked into the
 * viewBox rather than left to whatever margin the caller happens to apply.
 */
export function QRCode({ value, size = 176, label, className = '' }: Props) {
  const { path, extent } = useMemo(() => {
    const matrix = encodeQr(value);
    const QUIET = 4;
    return { path: qrPath(matrix), extent: matrix.length + QUIET * 2 };
  }, [value]);

  return (
    <svg
      viewBox={`-4 -4 ${extent} ${extent}`}
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      {/* The quiet zone must be light, so the background covers the whole viewBox. */}
      <rect x="-4" y="-4" width={extent} height={extent} fill="#ffffff" />
      <path d={path} fill="#1e2a4a" />
    </svg>
  );
}
