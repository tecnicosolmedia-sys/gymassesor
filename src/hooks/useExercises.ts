import { useState, useEffect, useCallback } from 'react';
import { Exercise, SetConfig } from '@/types/exercise';
import { supabase } from '@/integrations/supabase/client';

const LOCAL_STORAGE_KEY = 'gym-tracker-exercises-local';

const mapDbToExercise = (row: any): Exercise => ({
  id: row.id,
  name: row.name,
  sets: row.sets,
  reps: row.reps,
  weight: Number(row.weight),
  setConfigs: (row.set_configs as any[]) || [],
  restBetweenSets: row.rest_between_sets,
  restAfterExercise: row.rest_after_exercise,
  notes: row.notes,
  caloriesPerSet: Number(row.calories_per_set),
  muscleGroup: row.muscle_group,
  imageUrl: row.image_url ?? undefined,
  videoUrl: row.video_url ?? undefined,
  createdAt: new Date(row.created_at),
});

const mapExerciseToDb = (e: Omit<Exercise, 'id' | 'createdAt'>) => ({
  name: e.name,
  sets: e.sets,
  reps: e.reps,
  weight: e.weight,
  set_configs: JSON.parse(JSON.stringify(e.setConfigs)),
  rest_between_sets: e.restBetweenSets,
  rest_after_exercise: e.restAfterExercise,
  notes: e.notes,
  calories_per_set: e.caloriesPerSet,
  muscle_group: e.muscleGroup,
  image_url: e.imageUrl ?? null,
  video_url: e.videoUrl ?? null,
});

export const useExercises = () => {
  const [cloudExercises, setCloudExercises] = useState<Exercise[]>([]);
  const [localExercises, setLocalExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load local exercises from localStorage (migrate from old key if needed)
  useEffect(() => {
    let stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    // Migrate from old storage key
    const oldKey = 'gym-tracker-exercises';
    if (!stored) {
      const oldStored = localStorage.getItem(oldKey);
      if (oldStored) {
        stored = oldStored;
        localStorage.removeItem(oldKey);
      }
    }
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setLocalExercises(parsed.map((e: any) => ({
          ...e,
          createdAt: new Date(e.createdAt),
          setConfigs: e.setConfigs ? e.setConfigs.map((config: any) => ({
            ...config,
            reps: config.reps || e.reps,
          })) : Array.from({ length: e.sets }, (_, i) => ({
            setNumber: i + 1,
            reps: e.reps,
            weight: e.weight,
            restTime: e.restBetweenSets,
          })),
        })));
      } catch {
        setLocalExercises([]);
      }
    }
  }, []);

  // Persist local exercises
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localExercises));
    }
  }, [localExercises, isLoading]);

  // Fetch cloud exercises
  const fetchCloudExercises = useCallback(async () => {
    const { data, error } = await supabase.from('exercises').select('*').order('created_at', { ascending: true });
    if (!error && data) {
      setCloudExercises(data.map(mapDbToExercise));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCloudExercises();

    // Realtime subscription
    const channel = supabase
      .channel('exercises-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exercises' }, () => {
        fetchCloudExercises();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCloudExercises]);

  // Merged list: cloud first, then local
  const exercises = [...cloudExercises, ...localExercises];

  const addExercise = async (exercise: Omit<Exercise, 'id' | 'createdAt'>) => {
    // Add to cloud so all users can see it
    const { data, error } = await supabase.from('exercises').insert([mapExerciseToDb(exercise)]).select().single();
    if (!error && data) {
      const newExercise = mapDbToExercise(data);
      setCloudExercises(prev => [...prev, newExercise]);
      return newExercise;
    }
    // Fallback to local if cloud fails
    const localExercise: Exercise = {
      ...exercise,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    setLocalExercises(prev => [...prev, localExercise]);
    return localExercise;
  };

  const updateExercise = async (id: string, updates: Partial<Exercise>) => {
    const isCloud = cloudExercises.some(e => e.id === id);
    if (isCloud) {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.sets !== undefined) dbUpdates.sets = updates.sets;
      if (updates.reps !== undefined) dbUpdates.reps = updates.reps;
      if (updates.weight !== undefined) dbUpdates.weight = updates.weight;
      if (updates.setConfigs !== undefined) dbUpdates.set_configs = JSON.parse(JSON.stringify(updates.setConfigs));
      if (updates.restBetweenSets !== undefined) dbUpdates.rest_between_sets = updates.restBetweenSets;
      if (updates.restAfterExercise !== undefined) dbUpdates.rest_after_exercise = updates.restAfterExercise;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
      if (updates.caloriesPerSet !== undefined) dbUpdates.calories_per_set = updates.caloriesPerSet;
      if (updates.muscleGroup !== undefined) dbUpdates.muscle_group = updates.muscleGroup;
      if (updates.imageUrl !== undefined) dbUpdates.image_url = updates.imageUrl;
      if (updates.videoUrl !== undefined) dbUpdates.video_url = updates.videoUrl;
      await supabase.from('exercises').update(dbUpdates).eq('id', id);
      setCloudExercises(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    } else {
      setLocalExercises(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    }
  };

  const deleteExercise = async (id: string) => {
    const isCloud = cloudExercises.some(e => e.id === id);
    if (isCloud) {
      await supabase.from('exercises').delete().eq('id', id);
      setCloudExercises(prev => prev.filter(e => e.id !== id));
    } else {
      setLocalExercises(prev => prev.filter(e => e.id !== id));
    }
  };

  return {
    exercises,
    isLoading,
    addExercise,
    updateExercise,
    deleteExercise,
  };
};
