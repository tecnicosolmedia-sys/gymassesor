# Plan

Implementar un único borrador con dos áreas acotadas: edición estructural de series en la sesión actual y corrección visual del reloj de descanso en móvil. No se publicará ni se desplegará nada.

## A. Series durante y después del ejercicio

1. **Modelo de estado de sesión**
   - Ampliar el estado guardado de cada aparición para conservar `sessionSetConfigs`, `completedSets` y la estructura real por `instanceKey`.
   - Mantener compatibilidad con sesiones antiguas que no tengan estos campos.
   - Añadir utilidades puras para renumerar series, añadir, eliminar, editar y crear snapshots atómicos sin duplicados.

2. **Durante el ejercicio activo**
   - En la tarjeta activa, añadir controles para:
     - Añadir una serie al final.
     - Eliminar solo una serie pendiente sin confirmación.
     - Editar peso, repeticiones y descanso de series previstas sin romper el contador.
   - Si se intenta eliminar una serie completada, pedir confirmación clara antes de borrar.
   - Al añadir/eliminar, renumerar de forma consecutiva `setNumber`, `completedSets` y configuración local.
   - Toda modificación de estructura o valores se propagará al padre como estado de sesión, nunca a la plantilla maestra.

3. **Resumen del ejercicio**
   - Añadir botones “Editar registros” y “Añadir serie”.
   - Permitir corregir series registradas, eliminar series completadas con confirmación y añadir una serie realmente hecha.
   - Guardar vuelve al resumen recalculado con series, volumen, gráfica y análisis IA usando los valores actuales.
   - El botón Continuar enviará la configuración final de sesión de forma atómica.

4. **Historial y final del entrenamiento**
   - Asegurar que el snapshot final de cada ejercicio es la fuente real para el resumen, historial y guardado final.
   - Evitar deduplicación global; solo mantener coherencia por `instanceKey`.
   - No tocar registros históricos existentes ni crear migraciones.

5. **Aviso de estructura modificada para el futuro**
   - Detectar cambios estructurales solo cuando cambia el número de series respecto a la plantilla original.
   - Guardar un aviso pendiente por `instanceKey`/aparición cuando la sesión termina con estructura distinta.
   - Al volver a iniciar esa misma aparición, mostrar comparación “Plantilla original” vs “Última versión modificada”.
   - Ofrecer exactamente:
     - “Guardar versión modificada para el futuro”: actualiza la plantilla maestra con la estructura y valores finales válidos.
     - “Volver a la original”: usa la plantilla actual y consume el aviso.
   - No aplicar cambios a la plantilla sin elección del usuario.

## B. Reloj general y reloj de descanso

1. **Capa superior estable**
   - Convertir el reloj general en una cabecera sticky/fija con z-index superior a temporizadores, cartelas y modales informativos.
   - Respetar `safe-area-inset-top`.
   - Reservar su altura real mediante una variable CSS/medición para que el descanso empiece debajo, sin solaparse.

2. **Descanso responsivo**
   - Ajustar el layout del `FullscreenTimer` para usar el espacio restante bajo la cabecera.
   - Calcular diámetro de la esfera con `clamp()` y límites basados en ancho, alto disponible y orientación.
   - Reducir diámetro, márgenes, separación y tipografía en móvil horizontal compacto.
   - Mantener los dígitos centrados, con `tabular-nums`, `line-height` controlado y sin desbordamiento.

3. **Controles y overlays**
   - Mantener visibles pausa/reanudar, reiniciar, siguiente serie, progreso y “Ver ejercicio completo”.
   - Ajustar overlays existentes para no tapar la zona del reloj general.
   - No reiniciar ni recrear temporizadores por rotación o apertura/cierre de modales.

## Pruebas y validación

- Añadir pruebas unitarias/componentes para:
  - Añadir serie durante ejercicio.
  - Eliminar serie pendiente.
  - Confirmar eliminación completada.
  - Editar registros tras cerrar.
  - Añadir serie tras cerrar.
  - Terminar inmediatamente.
  - Rehidratar sesión antigua y sesión modificada.
  - Doble toque sobre serie.
  - Dos apariciones del mismo ejercicio aisladas por `instanceKey`.
  - Elegir guardar plantilla y elegir volver a original.
  - Clases/variables de layout portrait/landscape y no recreación del temporizador.
- Ejecutar suite completa, comprobación de tipos y build.
- Entregar resumen, archivos cambiados, resultados exactos y el commit actual reportado por el entorno.
