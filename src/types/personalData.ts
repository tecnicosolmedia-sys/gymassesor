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
