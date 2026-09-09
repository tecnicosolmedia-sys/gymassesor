import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, X, RotateCcw, Volume2, VolumeX, SwitchCamera, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  createRepCounter,
  createSmoother,
  createSpeechGate,
  elbowAngle,
  evaluateFeedback,
  getCoachConfig,
  pickSide,
  POSE_CONNECTIONS,
  shoulderTilt,
  sideVisibility,
  trunkLean,
  wristDrift,
  type FeedbackResult,
  type Landmark,
  type Phase,
} from '@/utils/poseCoach';

/**
 * Entrenador virtual (Beta).
 *
 * Privacidad: la inferencia ocurre íntegramente en el dispositivo con
 * @mediapipe/tasks-vision (versión fijada). Ningún fotograma, landmark ni
 * métrica se envía a servidores, ni se guarda en localStorage ni en la nube.
 */

// Versiones fijadas (no usar @latest en runtime).
const MEDIAPIPE_VERSION = '0.10.21';
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const TARGET_FPS = 11; // ~10–12 análisis por segundo
const MIN_FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

type Status =
  | 'intro'
  | 'loading'
  | 'ready'
  | 'no-person'
  | 'denied'
  | 'unsupported'
  | 'error';

const PHASE_LABEL: Record<Phase, string> = {
  start: 'Inicio',
  moving: 'Recorrido',
  end: 'Fin',
};

interface VirtualCoachProps {
  exerciseName: string;
  onClose: () => void;
}

export const VirtualCoach = ({ exerciseName, onClose }: VirtualCoachProps) => {
  const config = useMemo(() => getCoachConfig(exerciseName), [exerciseName]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<any>(null);
  const lastInferenceRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const mountedRef = useRef(true);

  const counterRef = useRef(
    createRepCounter({
      extendedAngle: config?.extendedAngle ?? 160,
      flexedAngle: config?.flexedAngle ?? 90,
      minRange: config?.minRange ?? 45,
    }),
  );
  const elbowSmootherRef = useRef(createSmoother(5));
  const trunkSmootherRef = useRef(createSmoother(5));
  const speechGateRef = useRef(createSpeechGate(4000));
  const movementRef = useRef({ left: 0, right: 0 });
  const lastAnglesRef = useRef<{ left: number | null; right: number | null }>({ left: null, right: null });

  const [status, setStatus] = useState<Status>('intro');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [reps, setReps] = useState(0);
  const [phase, setPhase] = useState<Phase>('start');
  const [feedback, setFeedback] = useState<FeedbackResult>({
    quality: 'warn',
    message: 'Colócate en el encuadre para empezar.',
    qualityLabel: 'Mejorable',
  });
  const [voiceOn, setVoiceOn] = useState(true);
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;

  /* --------------------------- limpieza total --------------------------- */
  const stopEverything = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try {
          t.stop();
        } catch {
          /* noop */
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        /* noop */
      }
    }
    if (landmarkerRef.current) {
      try {
        landmarkerRef.current.close?.();
      } catch {
        /* noop */
      }
      landmarkerRef.current = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopEverything();
    };
  }, [stopEverything]);

  const speak = useCallback((text: string, nowMs: number) => {
    if (!voiceOnRef.current) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (!speechGateRef.current.allow(text, nowMs)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES';
      window.speechSynthesis.speak(u);
    } catch {
      /* noop */
    }
  }, []);

  /* ------------------------------ bucle -------------------------------- */
  const draw = useCallback((landmarks: Landmark[] | null) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const w = video.videoWidth || canvas.width;
    const h = video.videoHeight || canvas.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks) return;

    ctx.strokeStyle = 'rgba(163, 230, 53, 0.9)';
    ctx.lineWidth = Math.max(2, canvas.width / 240);
    POSE_CONNECTIONS.forEach(([a, b]) => {
      const pa = landmarks[a];
      const pb = landmarks[b];
      if (!pa || !pb) return;
      ctx.beginPath();
      ctx.moveTo(pa.x * canvas.width, pa.y * canvas.height);
      ctx.lineTo(pb.x * canvas.width, pb.y * canvas.height);
      ctx.stroke();
    });
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    landmarks.forEach(p => {
      if (!p) return;
      ctx.beginPath();
      ctx.arc(p.x * canvas.width, p.y * canvas.height, Math.max(2, canvas.width / 320), 0, Math.PI * 2);
      ctx.fill();
    });
  }, []);

  const analyze = useCallback(
    (landmarks: Landmark[], nowMs: number) => {
      if (!config) return;

      const lAngle = elbowAngle(landmarks, 'left');
      const rAngle = elbowAngle(landmarks, 'right');
      const prev = lastAnglesRef.current;
      if (lAngle !== null && prev.left !== null) movementRef.current.left += Math.abs(lAngle - prev.left);
      if (rAngle !== null && prev.right !== null) movementRef.current.right += Math.abs(rAngle - prev.right);
      lastAnglesRef.current = { left: lAngle, right: rAngle };

      const side = pickSide(landmarks, config, movementRef.current);
      const rawElbow = side === 'left' ? lAngle : rAngle;
      const elbow = elbowSmootherRef.current.push(rawElbow);
      const trunk = trunkSmootherRef.current.push(trunkLean(landmarks));

      const driver = config.category === 'lower_back' ? (trunk === null ? null : 180 - trunk * 2) : elbow;
      const update = counterRef.current.update(driver, nowMs, sideVisibility(landmarks, side));

      setReps(update.reps);
      setPhase(update.phase);

      const result = evaluateFeedback({
        config,
        side,
        elbow,
        trunk,
        drift: wristDrift(landmarks, side),
        tilt: config.bilateral ? shoulderTilt(landmarks) : null,
        range: update.range,
        phase: update.phase,
      });
      setFeedback(result);
      if (result.quality !== 'good') speak(result.message, nowMs);
    },
    [config, speak],
  );

  const loop = useCallback(() => {
    if (!mountedRef.current) return;
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    rafRef.current = requestAnimationFrame(loop);
    if (!video || !landmarker || video.readyState < 2) return;

    const now = performance.now();
    if (now - lastInferenceRef.current < MIN_FRAME_INTERVAL_MS) return;
    // Reloj del vídeo: evita reprocesar el mismo fotograma.
    if (video.currentTime === lastVideoTimeRef.current) return;
    lastVideoTimeRef.current = video.currentTime;
    lastInferenceRef.current = now;

    try {
      const result = landmarker.detectForVideo(video, now);
      const landmarks: Landmark[] | undefined = result?.landmarks?.[0];
      if (landmarks && landmarks.length > 0) {
        setStatus('ready');
        draw(landmarks);
        analyze(landmarks, now);
      } else {
        setStatus('no-person');
        draw(null);
      }
    } catch {
      /* un fotograma fallido no debe romper el entrenamiento */
    }
  }, [analyze, draw]);

  /* ---------------------------- arranque ------------------------------- */
  const start = useCallback(
    async (mode: 'user' | 'environment') => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        return;
      }
      setStatus('loading');
      stopEverything();
      counterRef.current.reset();
      elbowSmootherRef.current.reset();
      trunkSmootherRef.current.reset();
      speechGateRef.current.reset();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!mountedRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play?.().catch(() => undefined);
        }

        // Import dinámico: no engorda el bundle inicial.
        const vision = await import('@mediapipe/tasks-vision');
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
        const landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (!mountedRef.current) {
          landmarker.close?.();
          return;
        }
        landmarkerRef.current = landmarker;
        lastVideoTimeRef.current = -1;
        setStatus('no-person');
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (!mountedRef.current) return;
        const name = (err as { name?: string })?.name;
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
      }
    },
    [loop, stopEverything],
  );

  const handleSwitchCamera = () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    void start(next);
  };

  const handleClose = () => {
    stopEverything();
    onClose();
  };

  const qualityClass =
    feedback.quality === 'good'
      ? 'border-primary text-primary'
      : feedback.quality === 'warn'
        ? 'border-amber-400 text-amber-400'
        : 'border-destructive text-destructive';

  /* ------------------------------ render ------------------------------- */
  return (
    <div className="fixed inset-0 z-[130] bg-background flex flex-col">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-base truncate">{exerciseName}</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
              Beta
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            Entrenador virtual · {config?.label ?? 'No disponible'}
          </p>
        </div>
        <button
          onClick={handleClose}
          aria-label="Cerrar entrenador virtual"
          className="p-2 rounded-xl bg-secondary text-foreground flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!config && (
          <div className="rounded-2xl border border-border p-4 text-sm">
            La evaluación técnica no está disponible para este ejercicio.
          </div>
        )}

        {config && status === 'intro' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border p-4 space-y-2">
              <h3 className="font-semibold">Cómo colocar el móvil</h3>
              <p className="text-sm text-muted-foreground">{config.placement}</p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Plano recomendado: {config.plane === 'frontal' ? 'frontal' : 'lateral o 45º'}.</li>
                <li>Cuerpo superior completo dentro del encuadre.</li>
                <li>Distancia de 2 a 3 metros y buena luz.</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border p-4 space-y-2">
              <h3 className="font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
                Privacidad
              </h3>
              <p className="text-sm text-muted-foreground">
                Todo el análisis ocurre en tu dispositivo. No se graba, no se guarda ni se envía
                ninguna imagen ni dato de la cámara.
              </p>
              <p className="text-sm text-muted-foreground">
                Es una orientación automática: no sustituye a un entrenador presencial y su precisión
                depende del ángulo de la cámara.
              </p>
            </div>
            <button
              onClick={() => void start(facing)}
              aria-label="Iniciar cámara"
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" aria-hidden="true" />
              Iniciar cámara
            </button>
          </div>
        )}

        {config && status !== 'intro' && (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] sm:aspect-video">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={cn(
                  'absolute inset-0 w-full h-full object-cover',
                  facing === 'user' && 'scale-x-[-1]',
                )}
              />
              <canvas
                ref={canvasRef}
                aria-hidden="true"
                className={cn(
                  'absolute inset-0 w-full h-full object-cover pointer-events-none',
                  facing === 'user' && 'scale-x-[-1]',
                )}
              />
              {(status === 'loading' || status === 'no-person') && (
                <div className="absolute inset-x-0 bottom-0 p-2 text-center text-xs bg-background/70">
                  {status === 'loading' ? 'Cargando cámara y modelo…' : 'No detecto a nadie en el encuadre'}
                </div>
              )}
            </div>

            {status === 'denied' && (
              <p className="text-sm text-destructive" role="alert">
                Permiso de cámara denegado. Actívalo en los ajustes del navegador para usar el entrenador.
              </p>
            )}
            {status === 'unsupported' && (
              <p className="text-sm text-destructive" role="alert">
                Este dispositivo o navegador no admite el acceso a la cámara.
              </p>
            )}
            {status === 'error' && (
              <p className="text-sm text-destructive" role="alert">
                No se pudo iniciar el análisis. Inténtalo de nuevo.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Repeticiones (cámara)</p>
                <p className="font-display text-3xl font-bold">{reps}</p>
                <p className="text-[11px] text-muted-foreground">
                  Solo informativo: no registra series.
                </p>
              </div>
              <div className="rounded-2xl border border-border p-3">
                <p className="text-xs text-muted-foreground">Fase</p>
                <p className="font-display text-2xl font-bold">{PHASE_LABEL[phase]}</p>
              </div>
            </div>

            <div className={cn('rounded-2xl border-2 p-3', qualityClass)} role="status" aria-live="polite">
              <p className="text-xs font-semibold uppercase tracking-wide">{feedback.qualityLabel}</p>
              <p className="text-sm text-foreground">{feedback.message}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleSwitchCamera}
                aria-label="Cambiar entre cámara frontal y trasera"
                className="flex-1 min-w-[9rem] py-2.5 rounded-xl bg-secondary text-sm font-medium flex items-center justify-center gap-2"
              >
                <SwitchCamera className="w-4 h-4" aria-hidden="true" />
                {facing === 'user' ? 'Frontal' : 'Trasera'}
              </button>
              <button
                onClick={() => {
                  counterRef.current.reset();
                  setReps(0);
                  setPhase('start');
                }}
                aria-label="Reiniciar contador de repeticiones"
                className="flex-1 min-w-[9rem] py-2.5 rounded-xl bg-secondary text-sm font-medium flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Reiniciar contador
              </button>
              <button
                onClick={() => {
                  setVoiceOn(v => !v);
                  try {
                    window.speechSynthesis?.cancel();
                  } catch {
                    /* noop */
                  }
                }}
                aria-label={voiceOn ? 'Desactivar voz' : 'Activar voz'}
                aria-pressed={voiceOn}
                className="flex-1 min-w-[9rem] py-2.5 rounded-xl bg-secondary text-sm font-medium flex items-center justify-center gap-2"
              >
                {voiceOn ? (
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <VolumeX className="w-4 h-4" aria-hidden="true" />
                )}
                {voiceOn ? 'Voz activada' : 'Voz desactivada'}
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Orientación automática en tu dispositivo. No sustituye a un entrenador presencial y la
              precisión depende del ángulo de la cámara.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
