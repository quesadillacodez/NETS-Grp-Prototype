import { ChevronLeft } from 'lucide-react';
import { ReactNode } from 'react';

interface Props {
  title: string;
  onBack: () => void;
  bottomGap?: string;
  padding?: string;
  children?: ReactNode;
}

export function DarkHeader({ title, onBack, bottomGap = 'mb-8', padding = 'pt-14 pb-8', children }: Props) {
  return (
    <div className={`bg-gradient-to-b from-[#1e2a4a] to-[#2d3f6a] px-6 ${padding}`}>
      <div className={`flex items-center justify-between ${bottomGap}`}>
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
        >
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-white font-semibold text-lg">{title}</h1>
        <div className="w-10" />
      </div>
      {children}
    </div>
  );
}
