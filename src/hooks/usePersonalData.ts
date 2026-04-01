import { useState, useEffect } from 'react';
import { PersonalData } from '@/types/personalData';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePersonalData = () => {
  const { user } = useAuth();
  const [personalData, setPersonalData] = useState<PersonalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) { setIsLoading(false); return; }
      const { data, error } = await supabase
        .from('personal_data')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!error && data) {
        setPersonalData({
          birthDate: data.birth_date || '',
          height: Number(data.height) || 0,
          weight: Number(data.weight) || 0,
          sex: (data.sex as PersonalData['sex']) || 'masculino',
        });
      }
      setIsLoading(false);
    };
    fetchData();
  }, [user]);

  const savePersonalData = async (data: PersonalData) => {
    if (!user) return;
    setPersonalData(data);

    const dbData = {
      user_id: user.id,
      birth_date: data.birthDate || null,
      height: data.height,
      weight: data.weight,
      sex: data.sex,
      updated_at: new Date().toISOString(),
    };

    // Upsert
    await supabase.from('personal_data').upsert(dbData, { onConflict: 'user_id' });
  };

  const clearPersonalData = async () => {
    if (!user) return;
    await supabase.from('personal_data').delete().eq('user_id', user.id);
    setPersonalData(null);
  };

  return {
    personalData,
    isLoading,
    savePersonalData,
    clearPersonalData,
  };
};
