import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface HistorySet {
  setNumber: number;
  reps: number;
  weight: number;
}
interface HistoryEntry {
  date: string;
  sets: HistorySet[];
}
interface RequestBody {
  exerciseName: string;
  muscleGroup: string;
  currentConfig: { setNumber: number; reps: number; weight: number; restTime: number }[];
  history: HistoryEntry[];
}

const roundHalf = (n: number) => Math.max(0, Math.min(999, Math.round(n * 2) / 2));
const clampReps = (n: number) => Math.max(1, Math.min(99, Math.round(n)));
const clampRest = (n: number) => Math.max(15, Math.min(600, Math.round(n)));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();
    if (!body?.exerciseName || !Array.isArray(body.currentConfig)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const history = (body.history || []).slice(0, 10);
    if (history.length === 0) {
      return new Response(JSON.stringify({ error: 'no_history' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const historyText = history.map((h, i) => {
      const setsStr = h.sets.map(s => `S${s.setNumber}: ${s.reps}reps @ ${s.weight}kg`).join(' | ');
      return `Sesión ${i + 1} (${h.date}): ${setsStr}`;
    }).join('\n');

    const currentText = body.currentConfig.map(c =>
      `S${c.setNumber}: ${c.reps}reps @ ${c.weight}kg (descanso ${c.restTime}s)`
    ).join(' | ');

    const systemPrompt = `Eres un entrenador de fuerza experto. Analiza el histórico reciente de un usuario para un ejercicio y sugiere la configuración óptima de la próxima sesión aplicando sobrecarga progresiva conservadora.

Reglas:
- Si en las últimas 2 sesiones completó todas las reps objetivo con buena consistencia, sube el peso: +2.5kg en compuestos, +1.25kg en aislamiento/pequeños grupos.
- Si no completó las reps objetivo, mantén el peso y prioriza cerrar las reps.
- Si hay retroceso claro en reps o peso, baja ligeramente el peso (-2.5kg) o mantén.
- Peso en pasos de 0.5kg (0-999). Reps entre 1 y 99. Descanso entre 15 y 600 segundos.
- Descanso: fuerza pesada (≤6 reps) 120-180s, hipertrofia (8-12) 60-90s, resistencia (>12) 30-60s.
- Devuelve EXACTAMENTE una serie por cada serie de la configuración actual, con el mismo setNumber.
- El comentario "coaching" debe tener 1-2 frases motivadoras y técnicas, en español.
- "basis" resume brevemente en qué te basas (1 frase).

Responde SOLO con JSON válido, sin texto adicional, con este esquema exacto:
{"setSuggestions":[{"setNumber":number,"reps":number,"weight":number}],"restBetweenSets":number,"coaching":string,"basis":string}`;

    const userPrompt = `Ejercicio: ${body.exerciseName} (${body.muscleGroup})

Configuración actual:
${currentText}

Histórico reciente (más reciente primero):
${historyText}

Sugiere la configuración para la próxima sesión.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': apiKey,
      },
      body: JSON.stringify({
        model: 'google/gemini-3.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('AI gateway error', aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: 'rate_limited' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: 'credits_exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'ai_error', details: errText }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiJson = await aiRes.json();
    const content: string = aiJson?.choices?.[0]?.message?.content ?? '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }

    const setSuggestions = Array.isArray(parsed.setSuggestions)
      ? parsed.setSuggestions.map((s: any, idx: number) => ({
          setNumber: Number(s.setNumber) || (idx + 1),
          reps: clampReps(Number(s.reps) || 0),
          weight: roundHalf(Number(s.weight) || 0),
        }))
      : [];

    const result = {
      setSuggestions,
      restBetweenSets: clampRest(Number(parsed.restBetweenSets) || 90),
      coaching: String(parsed.coaching || '').slice(0, 400),
      basis: String(parsed.basis || '').slice(0, 300),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('suggest-exercise-progression error', e);
    return new Response(JSON.stringify({ error: 'internal_error', details: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
