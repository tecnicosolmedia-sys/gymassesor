import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SplashScreen } from "@/components/SplashScreen";
import { useGlubSound } from "@/hooks/useGlubSound";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const GlubProvider = ({ children }: { children: React.ReactNode }) => {
  const playGlub = useGlubSound();

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, [role="button"], input[type="checkbox"], input[type="radio"], [data-clickable], .cursor-pointer, [onclick]')) {
        playGlub();
      }
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [playGlub]);

  return <>{children}</>;
};

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <GlubProvider>
          <Toaster />
          <Sonner />
          
          {showSplash && (
            <SplashScreen onComplete={() => setShowSplash(false)} />
          )}
          
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </GlubProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
