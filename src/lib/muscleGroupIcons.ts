// Muscle group icons mapping
import pechoIcon from '@/assets/muscle-groups/pecho.png';
import espaldaIcon from '@/assets/muscle-groups/espalda.png';
import hombrosIcon from '@/assets/muscle-groups/hombros.png';
import brazosIcon from '@/assets/muscle-groups/brazos.png';
import piernasIcon from '@/assets/muscle-groups/piernas.png';
import gluteosIcon from '@/assets/muscle-groups/gluteos.png';
import coreIcon from '@/assets/muscle-groups/core.png';

const muscleGroupIcons: Record<string, string> = {
  // Pecho
  'pecho': pechoIcon,
  'chest': pechoIcon,
  'pectoral': pechoIcon,
  'pectorales': pechoIcon,
  
  // Espalda
  'espalda': espaldaIcon,
  'back': espaldaIcon,
  'dorsal': espaldaIcon,
  'dorsales': espaldaIcon,
  'lats': espaldaIcon,
  
  // Hombros
  'hombros': hombrosIcon,
  'shoulders': hombrosIcon,
  'deltoides': hombrosIcon,
  'delts': hombrosIcon,
  
  // Brazos (bíceps y tríceps)
  'brazos': brazosIcon,
  'arms': brazosIcon,
  'biceps': brazosIcon,
  'bíceps': brazosIcon,
  'triceps': brazosIcon,
  'tríceps': brazosIcon,
  'bicep': brazosIcon,
  'tricep': brazosIcon,
  
  // Piernas
  'piernas': piernasIcon,
  'legs': piernasIcon,
  'cuádriceps': piernasIcon,
  'cuadriceps': piernasIcon,
  'quads': piernasIcon,
  'isquiotibiales': piernasIcon,
  'hamstrings': piernasIcon,
  'pantorrillas': piernasIcon,
  'calves': piernasIcon,
  'gemelos': piernasIcon,
  
  // Glúteos
  'gluteos': gluteosIcon,
  'glúteos': gluteosIcon,
  'glutes': gluteosIcon,
  'glute': gluteosIcon,
  
  // Core / Abdominales
  'core': coreIcon,
  'abdominales': coreIcon,
  'abs': coreIcon,
  'abdominal': coreIcon,
  'abdomen': coreIcon,
};

export const getMuscleGroupIcon = (muscleGroup: string): string | null => {
  if (!muscleGroup) return null;
  const normalized = muscleGroup.toLowerCase().trim();
  return muscleGroupIcons[normalized] || null;
};

export const MUSCLE_GROUPS = [
  'Pecho',
  'Espalda', 
  'Hombros',
  'Brazos',
  'Piernas',
  'Glúteos',
  'Core',
] as const;
