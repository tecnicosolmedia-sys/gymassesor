
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sets INTEGER NOT NULL DEFAULT 4,
  reps INTEGER NOT NULL DEFAULT 10,
  weight NUMERIC NOT NULL DEFAULT 0,
  set_configs JSONB NOT NULL DEFAULT '[]'::jsonb,
  rest_between_sets INTEGER NOT NULL DEFAULT 90,
  rest_after_exercise INTEGER NOT NULL DEFAULT 180,
  notes TEXT NOT NULL DEFAULT '',
  calories_per_set NUMERIC NOT NULL DEFAULT 0,
  muscle_group TEXT NOT NULL DEFAULT 'Pecho',
  image_url TEXT,
  video_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exercises" ON public.exercises FOR SELECT USING (true);
CREATE POLICY "Anyone can insert exercises" ON public.exercises FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update exercises" ON public.exercises FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete exercises" ON public.exercises FOR DELETE USING (true);

-- Seed default exercises
INSERT INTO public.exercises (name, sets, reps, weight, set_configs, rest_between_sets, rest_after_exercise, notes, calories_per_set, muscle_group) VALUES
('Press de Banca', 4, 10, 60, '[{"setNumber":1,"reps":10,"weight":50,"restTime":90},{"setNumber":2,"reps":10,"weight":60,"restTime":90},{"setNumber":3,"reps":10,"weight":60,"restTime":90},{"setNumber":4,"reps":8,"weight":55,"restTime":90}]'::jsonb, 90, 180, 'Mantén los codos a 45 grados. Baja la barra hasta el pecho controladamente.', 8, 'Pecho'),
('Sentadillas', 4, 12, 80, '[{"setNumber":1,"reps":12,"weight":60,"restTime":120},{"setNumber":2,"reps":12,"weight":80,"restTime":120},{"setNumber":3,"reps":10,"weight":80,"restTime":120},{"setNumber":4,"reps":10,"weight":70,"restTime":120}]'::jsonb, 120, 180, 'Rodillas en línea con los pies. Profundidad paralela o más.', 12, 'Piernas'),
('Peso Muerto', 3, 8, 100, '[{"setNumber":1,"reps":8,"weight":80,"restTime":150},{"setNumber":2,"reps":8,"weight":100,"restTime":150},{"setNumber":3,"reps":6,"weight":100,"restTime":150}]'::jsonb, 150, 180, 'Espalda recta. Empuja con los talones. Bloquea cadera arriba.', 15, 'Espalda');
