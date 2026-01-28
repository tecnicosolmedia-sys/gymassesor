export type Sex = 'masculino' | 'femenino';

export interface PersonalData {
  birthDate: string; // ISO date string
  height: number; // en cm
  weight: number; // en kg
  sex: Sex;
}

export const calculateAge = (birthDate: string): number => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Calcula las calorías quemadas en un entrenamiento de fuerza
 * Fórmula basada en MET (Metabolic Equivalent of Task)
 * Entrenamiento de fuerza moderado-vigoroso: MET ≈ 5-6
 * 
 * Calorías = (MET × peso en kg × duración en horas)
 * 
 * Se ajusta por sexo (mujeres queman ~10% menos) y edad (disminuye ~1% por año después de 30)
 */
export const calculateCaloriesBurned = (
  weightKg: number,
  durationSeconds: number,
  age: number,
  sex: Sex
): number => {
  const MET = 5.5; // MET promedio para entrenamiento de fuerza
  const durationHours = durationSeconds / 3600;
  
  // Cálculo base
  let calories = MET * weightKg * durationHours;
  
  // Ajuste por sexo (mujeres queman aproximadamente 10% menos)
  if (sex === 'femenino') {
    calories *= 0.9;
  }
  
  // Ajuste por edad (después de los 30, el metabolismo baja ~1% por año)
  if (age > 30) {
    const ageAdjustment = 1 - ((age - 30) * 0.01);
    calories *= Math.max(ageAdjustment, 0.7); // Mínimo 70% del valor base
  }
  
  return Math.round(calories);
};
