import { useState, useEffect, useCallback } from 'react';
import { Routine } from '@/types/routine';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useRoutines = () => {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRoutines = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    const { data, error } = await supabase
      .from('routines')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true });

    if (!error && data) {
      setRoutines(data.map((r: any) => ({
        id: r.id,
        name: r.name,
        exerciseIds: r.exercise_ids || [],
        createdAt: new Date(r.created_at),
      })));
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRoutines();
  }, [fetchRoutines]);

  const addRoutine = async (routine: Omit<Routine, 'id' | 'createdAt'>) => {
    if (!user) return { ...routine, id: '', createdAt: new Date() } as Routine;
    const { data, error } = await supabase
      .from('routines')
      .insert([{
        user_id: user.id,
        name: routine.name,
        exercise_ids: routine.exerciseIds,
        position: routines.length,
      }])
      .select()
      .single();

    if (!error && data) {
      const newRoutine: Routine = {
        id: data.id,
        name: data.name,
        exerciseIds: data.exercise_ids || [],
        createdAt: new Date(data.created_at),
      };
      setRoutines(prev => [...prev, newRoutine]);
      return newRoutine;
    }
    return { ...routine, id: crypto.randomUUID(), createdAt: new Date() } as Routine;
  };

  const updateRoutine = async (id: string, updates: Partial<Routine>) => {
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.exerciseIds !== undefined) dbUpdates.exercise_ids = updates.exerciseIds;

    await supabase.from('routines').update(dbUpdates).eq('id', id);
    setRoutines(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deleteRoutine = async (id: string) => {
    await supabase.from('routines').delete().eq('id', id);
    setRoutines(prev => prev.filter(r => r.id !== id));
  };

  const addExerciseToRoutine = async (routineId: string, exerciseId: string) => {
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return;
    const newIds = [...routine.exerciseIds, exerciseId];
    await supabase.from('routines').update({ exercise_ids: newIds }).eq('id', routineId);
    setRoutines(prev => prev.map(r => r.id === routineId ? { ...r, exerciseIds: newIds } : r));
  };

  const removeExerciseFromRoutine = async (routineId: string, exerciseId: string) => {
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return;
    const newIds = routine.exerciseIds.filter(id => id !== exerciseId);
    await supabase.from('routines').update({ exercise_ids: newIds }).eq('id', routineId);
    setRoutines(prev => prev.map(r => r.id === routineId ? { ...r, exerciseIds: newIds } : r));
  };

  const reorderRoutines = async (fromIndex: number, toIndex: number) => {
    const updated = [...routines];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setRoutines(updated);

    // Update positions in DB
    const updates = updated.map((r, i) =>
      supabase.from('routines').update({ position: i }).eq('id', r.id)
    );
    await Promise.all(updates);
  };

  return {
    routines,
    isLoading,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    addExerciseToRoutine,
    removeExerciseFromRoutine,
    reorderRoutines,
  };
};
