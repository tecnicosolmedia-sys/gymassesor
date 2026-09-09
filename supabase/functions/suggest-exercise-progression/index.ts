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
interface CurrentSet {
  setNumber: number;
  reps: number;
  weight: number;
  restTime: number;
}
interface RequestBody {
  exerciseName: string;
  muscleGroup?: string;
  isUnilateral?: boolean;
  currentConfig: CurrentSet[];
  currentRest?: number;
  history: HistoryEntry[];
}

const MAX_WEIGHT_DELTA_KG = 5;
const MAX_REPS_DELTA = 3;

const roundHalf = (n: number) =>
  Number.isFinite(n) ? Math.max(0, Math.min(999, Math.round(n * 2) / 2)) : 0;
const clampReps = (n: number) =>
  Number.isFinite(n) ? Math.max(1, Math.min(99, Math.round(n))) : 1;
const clampRest = (n: number) =>
  Number.isFinite(n) ? Math.max(15, Math.min(600, Math.round(n))) : 90;

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Número finito estricto: rechaza null, '', booleanos y textos no numéricos. */
const strictNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

/** Valida la entrada sin confiar en el cliente. */
const validate = (body: any): { ok: true; value: RequestBody } | { ok: false; reason: string } => {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'body' };
  if (typeof body.exerciseName !== 'string' || body.exerciseName.trim().length === 0) {
    return { ok: false, reason: 'exerciseName' };
  }
  if (!Array.isArray(body.currentConfig) || body.currentConfig.length === 0 || body.currentConfig.length > 20) {
    return { ok: false, reason: 'currentConfig' };
  }
  const currentConfig: CurrentSet[] = [];
  for (const [idx, c] of body.currentConfig.entries()) {
    if (!c || typeof c !== 'object') return { ok: false, reason: 'currentConfig' };
    currentConfig.push({
      setNumber: isFiniteNumber(c.setNumber) ? Math.round(c.setNumber) : idx + 1,
      reps: clampReps(Number(c.reps)),
      weight: roundHalf(Number(c.weight)),
      restTime: clampRest(Number(c.restTime)),
    });
  }
  if (!Array.isArray(body.history)) return { ok: false, reason: 'history' };
  const history: HistoryEntry[] = [];
  for (const h of body.history.slice(0, 10)) {
    if (!h || typeof h !== 'object' || typeof h.date !== 'string' || !Array.isArray(h.sets)) continue;
    const sets = h.sets
      .filter((s: any) => s && isFiniteNumber(Number(s.reps)) && isFiniteNumber(Number(s.weight)))
      .slice(0, 30)
      .map((s: any, i: number) => ({
        setNumber: isFiniteNumber(Number(s.setNumber)) ? Math.round(Number(s.setNumber)) : i + 1,
        reps: clampReps(Number(s.reps)),
        weight: roundHalf(Number(s.weight)),
      }));
    if (sets.length > 0) history.push({ date: h.date.slice(0, 10), sets });
  }
  if (history.length === 0) return { ok: false, reason: 'no_history' };

  return {
    ok: true,
    value: {
      exerciseName: body.exerciseName.slice(0, 200),
      muscleGroup: typeof body.muscleGroup === 'string' ? body.muscleGroup.slice(0, 80) : '',
      isUnilateral: body.isUnilateral === true,
      currentConfig,
      currentRest: isFiniteNumber(Number(body.currentRest)) ? clampRest(Number(body.currentRest)) : undefined,
      history,
    },
  };
};

/** Exactamente una sugerencia por serie actual, con límites conservadores y fallback seguro. */
const canonicalize = (currentConfig: CurrentSet[], raw: unknown) => {
  const list = Array.isArray(raw) ? raw : [];
  const bySet = new Map<number, any>();
  list.forEach((item: any) => {
    const n = strictNumber(item?.setNumber);
    if (n === undefined) return;
    const key = Math.round(n);
    if (!bySet.has(key)) bySet.set(key, item);
  });
  const usePositional = bySet.size === 0;

  return currentConfig.map((cfg, idx) => {
    const candidate = bySet.get(cfg.setNumber) ?? (usePositional ? list[idx] : undefined);
    const rawReps = strictNumber(candidate?.reps);
    const rawWeight = strictNumber(candidate?.weight);

    const reps = rawReps !== undefined
      ? Math.max(
          clampReps(cfg.reps - MAX_REPS_DELTA),
          Math.min(clampReps(cfg.reps + MAX_REPS_DELTA), clampReps(rawReps)),
        )
      : cfg.reps;

    const weight = rawWeight !== undefined
      ? Math.max(
          roundHalf(Math.max(0, cfg.weight - MAX_WEIGHT_DELTA_KG)),
          Math.min(roundHalf(cfg.weight + MAX_WEIGHT_DELTA_KG), roundHalf(rawWeight)),
        )
      : cfg.weight;

    return { setNumber: cfg.setNumber, reps, weight };
  });
};

const extractJsonBlock = (s: string): string => {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const base = fenced ? fenced[1] : s;
  const start = base.indexOf('{');
  if (start === -1) return base;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < base.length; i++) {
    const ch = base[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return base.slice(start, i + 1); }
  }
  return base.slice(start);
};

const repairJson = (s: string): string => {
  let out = '', inString = false, escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { out += ch; escape = false; continue; }
    if (ch === '\\') { out += ch; escape = true; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString) {
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
    }
    out += ch;
  }
  return out;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ error: 'LOVABLE_API_KEY not configured' }, 500);

    let rawBody: any;
    try {
      rawBody = await req.json();
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }

    const parsedInput = validate(rawBody);
    if (!parsedInput.ok) {
      return json({ error: parsedInput.reason === 'no_history' ? 'no_history' : 'invalid_request' }, 400);
    }
    const body = parsedInput.value;

    const historyText = body.history.map((h, i) => {
      const setsStr = h.sets.map(s => `S${s.setNumber}: ${s.reps}reps @ ${s.weight}kg`).join(' | ');
      return `Sesión ${i + 1} (${h.date}): ${setsStr}`;
    }).join('\n');

    const currentText = body.currentConfig.map(c =>
      `S${c.setNumber}: ${c.reps}reps @ ${c.weight}kg (descanso ${c.restTime}s)`
    ).join(' | ');

    const unilateralNote = body.isUnilateral
      ? `Este ejercicio es UNILATERAL: el número de repeticiones es SIEMPRE el TOTAL sumando ambos lados. No divides ni multiplicas: devuelve también totales, con la misma convención.`
      : `Este ejercicio es bilateral: las repeticiones son las de la serie completa.`;

    const systemPrompt = `Eres un entrenador de fuerza prudente. Dispones ÚNICAMENTE de los datos registrados: fecha, número de serie, repeticiones y kilos realizados, más la configuración actual. No dispones de RIR, sensaciones, técnica, fatiga ni de ningún objetivo de repeticiones cumplido o incumplido.

Reglas estrictas:
- NO afirmes ni supongas técnica, RIR, fatiga, esfuerzo ni cumplimiento de objetivos: no están registrados.
- Basa la sugerencia solo en la evolución observada de kilos y repeticiones registradas y en la configuración actual.
- Progresión conservadora: si en las sesiones recientes las repeticiones y la carga se mantienen o crecen de forma estable, sube el peso como máximo +2.5kg (o +1.25kg en grupos pequeños/aislamiento).
- Si los datos no justifican subir carga (variabilidad, retroceso o pocos datos), mantén el peso y propón cerrar o elevar repeticiones de forma prudente (máximo +1 o +2 reps).
- Si hay retroceso claro, mantén o baja como máximo 2.5kg.
- Nunca propongas saltos agresivos: máximo ±${MAX_WEIGHT_DELTA_KG}kg y ±${MAX_REPS_DELTA} reps respecto a la serie actual correspondiente.
- Peso en pasos de 0.5kg (0-999). Reps enteras entre 1 y 99. Descanso entre 15 y 600 segundos.
- Descanso orientativo: ≤6 reps 120-180s, 8-12 reps 60-90s, >12 reps 30-60s.
- Devuelve EXACTAMENTE una entrada por cada serie de la configuración actual, con los mismos setNumber y en el mismo orden.
- ${unilateralNote}
- "coaching": 1-2 frases en español, motivadoras y honestas, sin inventar datos.
- "basis": 1 frase indicando en qué datos registrados te basas.

Responde SOLO con JSON válido, sin texto adicional:
{"setSuggestions":[{"setNumber":number,"reps":number,"weight":number}],"restBetweenSets":number,"coaching":string,"basis":string}`;

    const userPrompt = `Ejercicio: ${body.exerciseName} (${body.muscleGroup})

Configuración actual:
${currentText}

Histórico reciente registrado (más reciente primero, sin calentamientos):
${historyText}

Sugiere la configuración para la próxima sesión.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': apiKey,
      },
      body: JSON.stringify({
        model: 'google/gemini-3.8-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      // No registramos el cuerpo: puede contener datos del usuario.
      console.error('AI gateway error status', aiRes.status);
      if (aiRes.status === 429) return json({ error: 'rate_limited' }, 429);
      if (aiRes.status === 402) return json({ error: 'credits_exhausted' }, 402);
      if (aiRes.status === 403) return json({ error: 'ai_blocked' }, 403);
      return json({ error: 'ai_error' }, 500);
    }

    const aiJson = await aiRes.json();
    const rawContent: string = aiJson?.choices?.[0]?.message?.content ?? '{}';

    let parsed: any = {};
    const candidate = extractJsonBlock(rawContent);
    try {
      parsed = JSON.parse(candidate);
    } catch {
      try {
        parsed = JSON.parse(repairJson(candidate));
      } catch {
        console.error('AI JSON parse failed (content length only):', candidate.length);
        // Fallback seguro: mantener la configuración actual.
        parsed = {};
      }
    }

    const result = {
      setSuggestions: canonicalize(body.currentConfig, parsed.setSuggestions),
      restBetweenSets: clampRest(
        Number.isFinite(Number(parsed.restBetweenSets))
          ? Number(parsed.restBetweenSets)
          : (body.currentRest ?? body.currentConfig[0]?.restTime ?? 90),
      ),
      coaching: String(parsed.coaching ?? '').slice(0, 400),
      basis: String(parsed.basis ?? '').slice(0, 300),
    };

    return json(result);
  } catch (e) {
    console.error('suggest-exercise-progression error:', (e as Error)?.name ?? 'error');
    return json({ error: 'internal_error' }, 500);
  }
});
