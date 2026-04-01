
-- 1. Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Add user_id to exercises for personal exercises
ALTER TABLE public.exercises ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies for exercises to support personal + global
DROP POLICY IF EXISTS "Anyone can read exercises" ON public.exercises;
DROP POLICY IF EXISTS "Anyone can insert exercises" ON public.exercises;
DROP POLICY IF EXISTS "Anyone can update exercises" ON public.exercises;
DROP POLICY IF EXISTS "Anyone can delete exercises" ON public.exercises;

CREATE POLICY "Users can read global and own exercises" ON public.exercises FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert exercises" ON public.exercises FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own exercises" ON public.exercises FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own exercises" ON public.exercises FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Routines table
CREATE TABLE public.routines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  exercise_ids TEXT[] NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own routines" ON public.routines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own routines" ON public.routines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own routines" ON public.routines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own routines" ON public.routines FOR DELETE USING (auth.uid() = user_id);

-- 4. Workout sessions table
CREATE TABLE public.workout_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  routine_id TEXT,
  routine_name TEXT,
  total_duration INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  is_complete BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions" ON public.workout_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.workout_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.workout_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sessions" ON public.workout_sessions FOR DELETE USING (auth.uid() = user_id);

-- 5. Workout session exercises
CREATE TABLE public.workout_session_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  muscle_group TEXT NOT NULL DEFAULT '',
  total_sets INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.workout_session_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own session exercises" ON public.workout_session_exercises FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid()));
CREATE POLICY "Users can insert own session exercises" ON public.workout_session_exercises FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid()));
CREATE POLICY "Users can delete own session exercises" ON public.workout_session_exercises FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.workout_sessions ws WHERE ws.id = session_id AND ws.user_id = auth.uid()));

-- 6. Workout completed sets
CREATE TABLE public.workout_completed_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_session_id UUID NOT NULL REFERENCES public.workout_session_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 0,
  rest_time INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_completed_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own completed sets" ON public.workout_completed_sets FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.workout_session_exercises wse
    JOIN public.workout_sessions ws ON ws.id = wse.session_id
    WHERE wse.id = exercise_session_id AND ws.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own completed sets" ON public.workout_completed_sets FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.workout_session_exercises wse
    JOIN public.workout_sessions ws ON ws.id = wse.session_id
    WHERE wse.id = exercise_session_id AND ws.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own completed sets" ON public.workout_completed_sets FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.workout_session_exercises wse
    JOIN public.workout_sessions ws ON ws.id = wse.session_id
    WHERE wse.id = exercise_session_id AND ws.user_id = auth.uid()
  ));

-- 7. Personal data table
CREATE TABLE public.personal_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date DATE,
  height NUMERIC,
  weight NUMERIC,
  sex TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.personal_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own personal data" ON public.personal_data FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own personal data" ON public.personal_data FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own personal data" ON public.personal_data FOR UPDATE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_routines_user_id ON public.routines(user_id);
CREATE INDEX idx_workout_sessions_user_id ON public.workout_sessions(user_id);
CREATE INDEX idx_workout_session_exercises_session_id ON public.workout_session_exercises(session_id);
CREATE INDEX idx_workout_completed_sets_exercise_session_id ON public.workout_completed_sets(exercise_session_id);
CREATE INDEX idx_exercises_user_id ON public.exercises(user_id);
CREATE INDEX idx_personal_data_user_id ON public.personal_data(user_id);
