import { useState, useEffect } from 'react';
import { PersonalData } from '@/types/personalData';

const STORAGE_KEY = 'gym-assessor-personal-data';

export const usePersonalData = () => {
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPersonalData(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing personal data:', e);
      }
    }
    setIsLoading(false);
  }, []);

  const savePersonalData = (data: PersonalData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setPersonalData(data);
  };

  const clearPersonalData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPersonalData(null);
  };

  return {
    personalData,
    isLoading,
    savePersonalData,
    clearPersonalData,
  };
};
