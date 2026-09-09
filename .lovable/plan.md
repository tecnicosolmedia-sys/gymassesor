# Modificación 3 — Análisis previo y propuesta

Análisis realizado sin tocar código ni datos. Todo lo que sigue está verificado leyendo el código y consultando la base de datos.

## Respuestas a tus preguntas

### 1. ¿Existe hoy algún campo de "unilateral" o de tipo de serie / calentamiento?
No. No existe absolutamente ningún campo, ni en la base de datos ni en el código:
- Un ejercicio guarda: nombre, series, repeticiones, peso, configuración por serie (nº de serie, reps, peso, descanso), descansos, notas, calorías, grupo muscular, imágenes.
- Una serie registrada guarda: nº de serie, reps, peso, descanso y fecha.
No hay marca de "por lado", ni de "calentamiento", ni de tipo de serie en ninguna tabla.

### 2. ¿Dónde se duplican o transforman las repeticiones?
En ningún sitio. Las repeticiones viajan intactas desde que las escribes hasta el historial: tarjeta de serie → tarjeta de ejercicio → sesión de entrenamiento → guardado en la nube → historial y gráficas. No hay ninguna multiplicación de repeticiones en toda la aplicación. Las únicas multiplicaciones que existen son el volumen (peso × repeticiones, que es lo normal) y el redondeo del peso a medios kilos.

### 3. ¿Por qué "Press inferior polea alta unilateral" muestra 24 en lugar de 12 por lado?
Porque el 24 está literalmente guardado así. Consulté el ejercicio y sus sesiones: su configuración guardada es 24, 24, 20, 20 repeticiones, y las series registradas en el historial también son 24, 24, 20, 20. Es decir, el valor se introdujo sumando ambos lados a mano (12 + 12). La aplicación no dobla nada; simplemente no sabe que ese ejercicio se hace por lados, así que muestra el número tal cual. Lo mismo ocurre en otros ejercicios unilaterales (Hombro Posterior Unilateral, Remo unilateral, Vuelo Unilateral...).

Consecuencia real: el volumen de esos ejercicios sí es correcto (24 repeticiones totales a ese peso), pero la lectura es engañosa, porque "24 reps" no dice que fueron 12 por lado, y los récords se comparan contra números que mezclan convenciones.

### 4. ¿Ejercicios con 0 series completadas contados como completados?
Hoy, en el uso normal, un ejercicio no puede marcarse como completado sin al menos una serie registrada. Pero hay dos puntos frágiles confirmados:
- Al borrar series de una sesión del historial, la fila del ejercicio se queda en la nube aunque ya no tenga ninguna serie (hoy no hay ninguna de estas filas huérfanas: comprobado, 0 casos).
- El contador global de estadísticas suma un ejercicio por cada fila de ejercicio, sin comprobar si tiene series. Si aparece una fila vacía, la cuenta se infla.

### 5. Solución mínima y retrocompatible propuesta
Tres piezas independientes, todas opcionales y sin tocar nada de lo ya guardado:

**a) Ejercicio unilateral (por lado)**
- Nueva marca opcional en el ejercicio: "Este ejercicio se realiza por lado".
- Cuando está activada, la aplicación muestra las repeticiones como "12 × 2 lados" y etiqueta "por lado" en la tarjeta, el resumen, el historial y las gráficas.
- Como los datos antiguos guardan el total sumado, la marca no reinterpreta nada del pasado por defecto: solo cambia la presentación de las series nuevas y muestra el histórico tal como se guardó, con una nota de que son repeticiones totales. Así ninguna sesión antigua cambia de valor.
- El volumen se sigue calculando con las repeticiones totales, que es lo correcto.

**b) Serie de calentamiento**
- Nueva marca opcional por serie: "calentamiento".
- Las series de calentamiento se siguen viendo en el detalle de la sesión, claramente identificadas, pero quedan fuera del volumen total, del recuento de series efectivas y de la detección de récords personales.
- Todo lo ya guardado se considera serie normal, así que ningún dato histórico cambia.

**c) Ejercicios sin series**
- Un ejercicio sin ninguna serie registrada no cuenta como ejercicio completado ni aporta series/volumen en ninguna estadística, y se muestra como "no realizado" en el detalle si aparece.
- Al borrar la última serie de un ejercicio del historial, se limpia también su ficha vacía.

Nada de esto modifica rutinas, sesiones ni el historial existente, ni requiere migrar datos.

## Detalles técnicos

Esquema (aditivo, sin migración de datos):
- `exercises`: nueva columna `is_unilateral boolean not null default false`.
- `workout_completed_sets`: nueva columna `is_warmup boolean not null default false`.
- Marca de calentamiento también en `SetConfig` (dentro del `set_configs` jsonb, opcional) para poder planificarla en la rutina.
- Los valores por defecto garantizan que todas las filas existentes se comporten exactamente como hoy.

Archivos a tocar:
- `src/types/exercise.ts` — `isUnilateral?` en `Exercise`; `isWarmup?` en `SetConfig`.
- `src/types/workoutHistory.ts` — `isWarmup?` en `CompletedSet`.
- `src/hooks/useExercises.ts` — leer/guardar `is_unilateral`.
- `src/components/ExerciseForm.tsx` — interruptor "Se realiza por lado" y marca de calentamiento por serie.
- `src/components/SetCard.tsx` — etiqueta "por lado" y marca de calentamiento en la serie activa.
- `src/components/ExerciseCard.tsx` — excluir calentamiento de la detección de récord; etiquetado por lado.
- `src/components/ExerciseSummary.tsx`, `src/components/CompletedExercisesReview.tsx` — volumen y series efectivas sin calentamiento; formato por lado.
- `src/hooks/useWorkoutHistory.ts` — persistir `is_warmup`; excluir calentamiento del volumen; no contar ejercicios sin series; borrar la ficha de ejercicio cuando se queda sin series.
- `src/components/WorkoutHistory.tsx` — mostrar calentamiento identificado, no realizado, y "por lado".
- `src/components/PersonalRecordsView.tsx` — ignorar series de calentamiento.
- `src/components/ExerciseProgressChart.tsx` — ignorar calentamiento en la progresión.
- `src/components/WorkoutFlow.tsx` — no marcar como completado un ejercicio sin series.
- `src/utils/exportWorkoutPDF.ts` — reflejar calentamiento y "por lado".

Pruebas necesarias:
1. Volumen y series de una sesión con y sin series de calentamiento.
2. Récord personal no dispara con una serie de calentamiento más pesada.
3. Ejercicio sin series: no cuenta como completado ni suma volumen; sigue visible en el detalle.
4. Borrar la última serie de un ejercicio limpia su ficha y las estadísticas.
5. Formato "por lado" en ejercicio marcado como unilateral y formato normal en el resto.
6. Retrocompatibilidad: sesiones y ejercicios antiguos (sin las nuevas marcas) muestran y calculan exactamente los mismos valores que hoy.
7. TypeScript, build y suite de pruebas.

Sin publicar y sin migración de datos.
