import { useTimer } from '@/hooks/useTimer';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimerProps {
  initialTime: number;
  label: string;
  onComplete?: () => void;
  variant?: 'default' | 'compact';
  autoStart?: boolean;
}

export const Timer = ({ 
  initialTime, 
  label, 
  onComplete, 
  variant = 'default',
  autoStart = false 
}: TimerProps) => {
  const { timeLeft, isRunning, isComplete, toggle, reset } = useTimer({
    initialTime,
    onComplete,
    autoStart,
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((initialTime - timeLeft) / initialTime) * 100;
  const isWarning = timeLeft <= 3 && timeLeft > 0;

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
        <button
          onClick={toggle}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
            isRunning 
              ? "bg-warning/20 text-warning" 
              : "bg-primary/20 text-primary"
          )}
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn(
            "text-xl font-display font-bold transition-all",
            isWarning && "text-warning animate-countdown",
            isComplete && "text-primary"
          )}>
            {formatTime(timeLeft)}
          </p>
        </div>
        
        <button
          onClick={() => reset()}
          className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative p-6 rounded-2xl card-gradient border border-border overflow-hidden transition-all duration-300",
      isRunning && "glow-energy",
      isComplete && "border-primary"
    )}>
      {/* Background glow effect */}
      <div 
        className="absolute inset-0 bg-glow opacity-50 pointer-events-none"
        style={{ opacity: isRunning ? 0.5 : 0.2 }}
      />
      
      {/* Progress ring background */}
      <div className="relative flex flex-col items-center">
        <p className="text-sm text-muted-foreground mb-2 font-medium">{label}</p>
        
        <div className="relative w-40 h-40 mb-4">
          {/* Background circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
            />
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke={isWarning ? "hsl(var(--warning))" : "hsl(var(--primary))"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 70}
              strokeDashoffset={2 * Math.PI * 70 * (1 - progress / 100)}
              className="transition-all duration-1000"
            />
          </svg>
          
          {/* Time display */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn(
              "text-4xl font-display font-bold transition-all",
              isWarning && "text-warning animate-countdown scale-110",
              isComplete && "text-primary"
            )}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex gap-3">
          <button
            onClick={toggle}
            className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg",
              isRunning 
                ? "bg-warning text-warning-foreground hover:bg-warning/90" 
                : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-energy"
            )}
          >
            {isRunning ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-1" />
            )}
          </button>
          
          <button
            onClick={() => reset()}
            className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
