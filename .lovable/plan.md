
## Objetivo

Añadir un botón **✨ Sugerir IA** en la tarjeta de cada ejercicio (antes de empezar / durante el ejercicio) que consulte el histórico de ese ejercicio para el usuario y devuelva una sugerencia informativa (no aplica cambios automáticamente) sobre:

- Peso por serie (respetando pasos de 0.5 kg)
- Repeticiones por serie
- Descanso entre series
- Comentario breve de coaching/progresión

## Arquitectura

```text
ExerciseCard (botón ✨)
      │
      ▼
supabase.functions.invoke('suggest-exercise-progression')
      │  { exerciseId, exerciseName, muscleGroup, currentConfig, historyDigest }
      ▼
Edge Function (verify_jwt = true)
      │  Lovable AI Gateway (google/gemini-3.5-flash)
      ▼
JSON estructurado → Dialog de sugerencia
```

## Cambios

### 1. Edge Function: `supabase/functions/suggest-exercise-progression/index.ts` (nuevo)

- CORS + validación de JWT en código (obtiene `user_id`).
- Recibe: `exerciseId`, `exerciseName`, `muscleGroup`, `currentConfig` (setConfigs actuales + descanso), y opcionalmente ya un `historyDigest` compacto desde el cliente. Si no llega, la función consulta las últimas ~10 sesiones del usuario para ese `exerciseId` (`workout_session_exercises` + `workout_completed_sets`) usando el service role.
- Llama a Lovable AI Gateway con `google/gemini-3.5-flash` vía AI SDK (`generateText` + `Output.object` con Zod, esquema pequeño sin bounds; los rangos se explican en el prompt y se clampan en código: peso 0–999 en pasos de 0.5, reps 1–99, descanso 15–300s).
- System prompt: entrenador de fuerza; principio de sobrecarga progresiva conservador; si últimas 2 sesiones completaron todas las reps objetivo → subir peso 2.5 kg (o 1.25 en aislamiento); si fallaron reps → mantener peso y buscar completar; ajustar descanso según reps altas/bajas.
- Respuesta JSON:
  ```ts
  {
    setSuggestions: { setNumber, reps, weight }[],
    restBetweenSets: number,
    coaching: string, // 1–2 frases
    basis: string     // resumen del histórico usado
  }
  ```
- Manejo de errores 429 / 402 con mensajes claros. `LOVABLE_API_KEY` ya está en secrets.

### 2. Hook: `src/hooks/useAISuggestion.ts` (nuevo)

- Estado: `loading`, `error`, `suggestion`.
- `requestSuggestion(exercise)`: construye payload con `setConfigs` actuales y llama a la edge function con `supabase.functions.invoke`.

### 3. UI: `src/components/AISuggestionDialog.tsx` (nuevo)

- Dialog con estética neon/lime del proyecto.
- Muestra:
  - Tabla comparativa **Actual → Sugerido** por serie (peso, reps).
  - Descanso sugerido entre series.
  - Bloque de coaching (texto).
  - Pie con `basis` (resumen del histórico usado).
- Solo informativo: botón **Cerrar** (sin "Aplicar"). Copiable no necesario.
- Estado de carga (spinner + "Analizando tu histórico…") y estado de error (con toast).

### 4. `src/components/ExerciseCard.tsx`

- Añadir botón **✨ Sugerir IA** en la cabecera de la tarjeta, visible antes de empezar la primera serie y durante el ejercicio (no en pantalla de resumen final).
- Al pulsar: llama al hook y abre `AISuggestionDialog`.
- Deshabilitado si no hay histórico previo del ejercicio (mostrar tooltip "Sin histórico todavía") — se detecta con `getExerciseHistory(exerciseId).length === 0` pasado como prop desde `Index.tsx`.

### 5. `src/pages/Index.tsx`

- Pasar `getExerciseHistory` (o el count) a `ExerciseCard` a través de `WorkoutFlow` para saber si habilitar el botón.

## Detalles técnicos

- Modelo: `google/gemini-3.5-flash` (rápido, económico, calidad suficiente).
- Se envía sólo el digest de histórico (últimas ~10 sesiones, series completadas con reps/peso/fecha) para minimizar tokens.
- Todo el peso sugerido se clampa a múltiplos de 0.5 en el servidor antes de devolver.
- Errores del gateway se muestran como toast; el dialog se cierra.
- Nada persiste en DB: la sugerencia es solo informativa.

## Fuera de alcance

- Aplicar automáticamente las sugerencias a la sesión o rutina.
- Sugerencias globales de rutina completa (solo por ejercicio).
- Historial de sugerencias previas.
