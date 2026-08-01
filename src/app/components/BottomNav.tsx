import { Award, Home, ScanLine, User, Users } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';

const NAV_ITEMS = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: ScanLine, label: 'Scan', path: '/scan' },
  { icon: Users, label: 'Hangouts', path: '/hangouts' },
  { icon: Award, label: 'Rewards', path: '/rewards' },
  { icon: User, label: 'Profile', path: '/profile' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-border">
      <div className="flex items-stretch px-2 py-2 safe-area-bottom">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-1 transition-all"
            >
              <div className="relative">
                <Icon className={`w-6 h-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <span className={`text-[11px] leading-none ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
