import { Undo2 } from 'lucide-react';

interface FloatingBackButtonProps {
  onClick: () => void;
  visible: boolean;
}

export const FloatingBackButton = ({ onClick, visible }: FloatingBackButtonProps) => {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-[70] w-14 h-14 rounded-full bg-secondary border border-border text-foreground shadow-lg flex items-center justify-center hover:bg-secondary/80 active:scale-95 transition-all safe-area-bottom"
      aria-label="Volver"
    >
      <Undo2 className="w-6 h-6" />
    </button>
  );
};
