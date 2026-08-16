import {
  Award, Bell, BellRing, ChartColumn, CreditCard, History, LifeBuoy, Split,
  Sparkles, UsersRound, Wallet, type LucideIcon,
} from 'lucide-react';

/**
 * Resolves the icon name stored against a Quick Action to a component.
 *
 * The catalogue stores names rather than components so a chosen set is a list
 * of plain ids that can live in the database. The map is explicit rather than a
 * lookup into the whole `lucide-react` namespace, which would pull every icon
 * in the library into the bundle.
 */
const ICONS: Record<string, LucideIcon> = {
  Award, Bell, BellRing, ChartColumn, CreditCard, History, LifeBuoy, Split,
  Sparkles, UsersRound, Wallet,
};

export function QuickActionIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? CreditCard;
  return <Icon className={className} aria-hidden="true" />;
}
