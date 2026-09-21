# Roadmap

## Modificación 3 — cálculos e historial fiables (COMPLETADA)
- [x] Migración aditiva: `exercises.is_unilateral`, `workout_completed_sets.is_warmup`
- [x] Helpers puros centralizados en `src/utils/workoutStats.ts`
- [x] Tipos: `SetConfig.isWarmup`, `Exercise.isUnilateral`, `CompletedSet.isWarmup`
- [x] Marcado de calentamiento en configuración y durante el ejercicio
- [x] Interruptor "ejercicio unilateral" en el formulario
- [x] Estadísticas: ejercicios con 0 series no cuentan; calentamientos fuera de volumen/series/récords/gráficas
- [x] Limpieza de ficha vacía al borrar la última serie histórica
- [x] Historial, récords, resúmenes, revisión mid-workout y PDF actualizados
- [x] Pruebas unitarias + TypeScript + build + tests
- [ ] Implementar en un único borrador la edición estructural de series y la corrección visual de relojes, con pruebas, tipos y build; sin publicar ni desplegar.
- [ ] Completar el commit parcial: cerrar cableado estructural, corregir reloj móvil, añadir pruebas completas, tipos y build; no publicar.
