# Roadmap

## Modificación 3 — cálculos e historial fiables (en curso)
- [x] Migración aditiva: `exercises.is_unilateral`, `workout_completed_sets.is_warmup`
- [x] Helpers puros centralizados en `src/utils/workoutStats.ts`
- [ ] Tipos: `isUnilateral` en `Exercise`, `isWarmup` en `SetConfig` y `CompletedSet`
- [ ] Persistencia ida/vuelta en `useExercises` y `useWorkoutHistory`
- [ ] Interruptor "Ejercicio unilateral" en `ExerciseForm`
- [ ] Marcar serie como calentamiento (configuración y durante el ejercicio)
- [ ] Excluir calentamientos de volumen, series efectivas, récords y gráficas
- [ ] Ejercicios con 0 series: no cuentan; limpiar ficha vacía al borrar última serie
- [ ] Presentación "por lado" en resumen, historial, récords y PDF
- [ ] Pruebas unitarias + TypeScript + build + tests
