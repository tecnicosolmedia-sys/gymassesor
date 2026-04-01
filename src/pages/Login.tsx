import { useState } from 'react';
import { lovable } from '@/integrations/lovable/index';
import { Dumbbell, Loader2 } from 'lucide-react';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });

      if (result.error) {
        setError('Error al iniciar sesión. Inténtalo de nuevo.');
        setLoading(false);
        return;
      }

      if (result.redirected) {
        return; // Browser will redirect
      }
    } catch {
      setError('Error al conectar con Google.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Glow background */}
      <div className="fixed inset-0 bg-glow pointer-events-none opacity-30" />

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full">
        {/* Logo */}
        <div className="w-20 h-20 rounded-3xl bg-primary/20 flex items-center justify-center mb-6 shadow-energy">
          <Dumbbell className="w-10 h-10 text-primary" />
        </div>

        <h1 className="font-display font-black text-3xl text-foreground mb-2 text-center">
          GYM Asesor
        </h1>
        <p className="text-muted-foreground text-center mb-10">
          Tu entrenador personal inteligente
        </p>

        {/* Google login button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white text-gray-800 font-semibold text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          {loading ? 'Conectando...' : 'Continuar con Google'}
        </button>

        {error && (
          <p className="mt-4 text-sm text-destructive text-center">{error}</p>
        )}

        <p className="mt-8 text-xs text-muted-foreground text-center max-w-xs">
          Tus datos de entrenamiento se sincronizarán de forma segura en la nube
        </p>
      </div>
    </div>
  );
};

export default Login;
