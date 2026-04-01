import { useState, useEffect, useCallback } from 'react';
import { Exercise } from '@/types/exercise';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

const mapExerciseToDb = (e: Omit<Exercise, 'id' | 'createdAt'>, userId?: string) => ({
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
  user_id: userId ?? null,
});

export const useExercises = () => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchExercises = useCallback(async () => {
    // Fetch global exercises (user_id IS NULL) and user's own exercises
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setExercises(data.map(mapDbToExercise));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchExercises();

    const channel = supabase
      .channel('exercises-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exercises' }, () => {
        fetchExercises();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchExercises]);

  const addExercise = async (exercise: Omit<Exercise, 'id' | 'createdAt'>) => {
    const { data, error } = await supabase
      .from('exercises')
      .insert([mapExerciseToDb(exercise, user?.id)])
      .select()
      .single();

    if (!error && data) {
      const newExercise = mapDbToExercise(data);
      setExercises(prev => [...prev, newExercise]);
      return newExercise;
    }

    // Fallback
    const localExercise: Exercise = {
      ...exercise,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    return localExercise;
  };

  const updateExercise = async (id: string, updates: Partial<Exercise>) => {
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
    setExercises(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const deleteExercise = async (id: string) => {
    await supabase.from('exercises').delete().eq('id', id);
    setExercises(prev => prev.filter(e => e.id !== id));
  };

  return {
    exercises,
    isLoading,
    addExercise,
    updateExercise,
    deleteExercise,
  };
};
