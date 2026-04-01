import { supabase } from '@/integrations/supabase/client';

const MIGRATION_KEY = 'gym-tracker-cloud-migrated';
const ROUTINES_KEY = 'gym-tracker-routines';
const HISTORY_KEY = 'gym-tracker-workout-history';
const PERSONAL_KEY = 'gym-assessor-personal-data';
const EXERCISES_LOCAL_KEY = 'gym-tracker-exercises-local';

export const migrateLocalDataToCloud = async (userId: string): Promise<boolean> => {
  // Check if already migrated
  if (localStorage.getItem(MIGRATION_KEY)) return false;

  let migrated = false;

  // 1. Migrate routines
  const routinesRaw = localStorage.getItem(ROUTINES_KEY);
  if (routinesRaw) {
    try {
      const routines = JSON.parse(routinesRaw);
      if (routines.length > 0) {
        const rows = routines.map((r: any, i: number) => ({
          user_id: userId,
          name: r.name,
          exercise_ids: r.exerciseIds || [],
          position: i,
        }));
        await supabase.from('routines').insert(rows);
        migrated = true;
      }
    } catch { /* ignore */ }
  }

  // 2. Migrate personal data
  const personalRaw = localStorage.getItem(PERSONAL_KEY);
  if (personalRaw) {
    try {
      const pd = JSON.parse(personalRaw);
      await supabase.from('personal_data').upsert({
        user_id: userId,
        birth_date: pd.birthDate || null,
        height: pd.height || 0,
        weight: pd.weight || 0,
        sex: pd.sex || 'masculino',
      }, { onConflict: 'user_id' });
      migrated = true;
    } catch { /* ignore */ }
  }

  // 3. Migrate local exercises
  const exercisesRaw = localStorage.getItem(EXERCISES_LOCAL_KEY);
  if (exercisesRaw) {
    try {
      const exercises = JSON.parse(exercisesRaw);
      if (exercises.length > 0) {
        const rows = exercises.map((e: any) => ({
          user_id: userId,
          name: e.name,
          sets: e.sets || 4,
          reps: e.reps || 10,
          weight: e.weight || 0,
          set_configs: e.setConfigs ? JSON.parse(JSON.stringify(e.setConfigs)) : [],
          rest_between_sets: e.restBetweenSets || 90,
          rest_after_exercise: e.restAfterExercise || 180,
          notes: e.notes || '',
          calories_per_set: e.caloriesPerSet || 0,
          muscle_group: e.muscleGroup || 'Pecho',
          image_url: e.imageUrl || null,
          video_url: e.videoUrl || null,
        }));
        await supabase.from('exercises').insert(rows);
        migrated = true;
      }
    } catch { /* ignore */ }
  }

  // 4. Migrate workout history
  const historyRaw = localStorage.getItem(HISTORY_KEY);
  if (historyRaw) {
    try {
      const sessions = JSON.parse(historyRaw);
      for (const s of sessions) {
        const { data: sessionRow, error } = await supabase
          .from('workout_sessions')
          .insert([{
            user_id: userId,
            date: s.date,
            routine_id: s.routineId || null,
            routine_name: s.routineName || null,
            total_duration: s.totalDuration || 0,
            started_at: s.startedAt || s.date,
            completed_at: s.completedAt || null,
            is_complete: s.isComplete ?? true,
          }])
          .select()
          .single();

        if (error || !sessionRow) continue;

        for (const ex of (s.exercises || [])) {
          const { data: exRow } = await supabase
            .from('workout_session_exercises')
            .insert([{
              session_id: sessionRow.id,
              exercise_id: ex.exerciseId,
              exercise_name: ex.exerciseName,
              muscle_group: ex.muscleGroup || '',
              total_sets: ex.totalSets || 0,
              started_at: ex.startedAt || s.date,
              completed_at: ex.completedAt || null,
            }])
            .select()
            .single();

          if (exRow && ex.completedSets?.length > 0) {
            const sets = ex.completedSets.map((set: any) => ({
              exercise_session_id: exRow.id,
              set_number: set.setNumber,
              reps: set.reps,
              weight: set.weight,
              rest_time: set.restTime || 0,
              completed_at: set.completedAt || new Date().toISOString(),
            }));
            await supabase.from('workout_completed_sets').insert(sets);
          }
        }
        migrated = true;
      }
    } catch { /* ignore */ }
  }

  // Mark as migrated
  localStorage.setItem(MIGRATION_KEY, 'true');
  return migrated;
};
