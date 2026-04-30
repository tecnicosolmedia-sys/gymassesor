import { Plus, Calendar, TrendingUp, User, LogOut, Trophy } from 'lucide-react';
import logo from '@/assets/logo.png';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  onAddExercise: () => void;
  onAddRoutine: () => void;
  onShowHistory: () => void;
  onShowPersonalData: () => void;
  onShowRecords: () => void;
}

export const Header = ({ onAddExercise, onAddRoutine, onShowHistory, onShowPersonalData, onShowRecords }: HeaderProps) => {
  const { user, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border safe-area-top">
      <div className="w-full px-3 sm:px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
            <img 
              src={logo} 
              alt="Gym Assessor Logo" 
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl object-cover glow-energy flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="font-display font-bold text-lg sm:text-xl text-gradient-energy truncate">
                Gym Assessor
              </h1>
              <p className="text-xs text-muted-foreground hidden xs:block">Tu rutina personal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={onShowPersonalData}
              className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-2.5 rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              title="Datos personales"
            >
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="" className="w-5 h-5 rounded-full" />
              ) : (
                <User className="w-4 h-4" />
              )}
              <span className="hidden sm:inline sm:ml-2">Perfil</span>
            </button>
            <button
              onClick={onShowHistory}
              className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-2.5 rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              title="Historial"
            >
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline sm:ml-2">Historial</span>
            </button>
            <button
              onClick={onAddRoutine}
              className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 rounded-xl bg-secondary text-foreground font-medium hover:bg-secondary/80 transition-all"
              title="Nueva rutina"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline sm:ml-2">Rutina</span>
            </button>
            <button
              onClick={onAddExercise}
              className="flex items-center justify-center w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-energy"
              title="Nuevo ejercicio"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline sm:ml-2">Ejercicio</span>
            </button>
            <button
              onClick={signOut}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-secondary/50 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
