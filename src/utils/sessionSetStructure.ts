import { Exercise, SetConfig } from '@/types/exercise';

export interface StructuralChangeNotice {
  routineId?: string;
  routineName?: string;
  exerciseId: string;
  instanceKey: string;
  exerciseName: string;
  originalConfigs: SetConfig[];
  modifiedConfigs: SetConfig[];
  savedAt: string;
}

export const STRUCTURAL_NOTICE_KEY = 'gym-tracker-structural-set-notices';

const cloneConfig = (config: SetConfig, index: number): SetConfig => ({
  ...config,
  setNumber: index + 1,
  reps: clampReps(config.reps),
  weight: clampWeight(config.weight),
  restTime: clampRest(config.restTime),
});

export const clampReps = (value: number) => Math.max(1, Math.min(99, Math.round(value)));

export const clampWeight = (value: number) => Math.max(0, Math.min(999, Math.round(value * 2) / 2));

export const clampRest = (value: number) => Math.max(5, Math.min(600, Math.round(value)));

export const normalizeSetConfigs = (configs: SetConfig[]): SetConfig[] =>
  configs.map((config, index) => cloneConfig(config, index));

export const getTemplateConfigs = (exercise: Exercise): SetConfig[] => {
  const source = exercise.setConfigs && exercise.setConfigs.length > 0
    ? exercise.setConfigs
    : Array.from({ length: Math.max(1, exercise.sets || 1) }, (_, i) => ({
      setNumber: i + 1,
      reps: exercise.reps,
      weight: exercise.weight,
      restTime: exercise.restBetweenSets,
    }));
  return normalizeSetConfigs(source);
};

export const addSessionSet = (configs: SetConfig[], fallback?: SetConfig): SetConfig[] => {
  const base = fallback || configs[configs.length - 1] || { setNumber: 1, reps: 10, weight: 0, restTime: 60 };
  return normalizeSetConfigs([
    ...configs,
    { ...base, setNumber: configs.length + 1 },
  ]);
};

export const removeSessionSet = (
  configs: SetConfig[],
  completedSets: number[],
  currentSet: number,
  removeIndex: number,
) => {
  const removedSetNumber = removeIndex + 1;
  const nextConfigs = normalizeSetConfigs(configs.filter((_, index) => index !== removeIndex));
  const nextCompletedSets = Array.from(new Set(
    completedSets
      .filter((setNumber) => setNumber !== removedSetNumber)
      .map((setNumber) => (setNumber > removedSetNumber ? setNumber - 1 : setNumber)),
  )).sort((a, b) => a - b);
  const nextCurrentSet = Math.max(1, Math.min(
    currentSet > removedSetNumber ? currentSet - 1 : currentSet,
    Math.max(1, nextConfigs.length),
  ));
  return { nextConfigs, nextCompletedSets, nextCurrentSet };
};

export const hasStructuralChange = (original: SetConfig[], modified: SetConfig[]) =>
  normalizeSetConfigs(original).length !== normalizeSetConfigs(modified).length;

const readNotices = (): StructuralChangeNotice[] => {
  try {
    const raw = localStorage.getItem(STRUCTURAL_NOTICE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeNotices = (notices: StructuralChangeNotice[]) => {
  localStorage.setItem(STRUCTURAL_NOTICE_KEY, JSON.stringify(notices));
};

export const loadStructuralChangeNotice = (instanceKey: string): StructuralChangeNotice | null =>
  readNotices().find((notice) => notice.instanceKey === instanceKey) ?? null;

export const saveStructuralChangeNotice = (notice: StructuralChangeNotice) => {
  const notices = readNotices().filter((item) => item.instanceKey !== notice.instanceKey);
  writeNotices([
    ...notices,
    {
      ...notice,
      originalConfigs: normalizeSetConfigs(notice.originalConfigs),
      modifiedConfigs: normalizeSetConfigs(notice.modifiedConfigs),
    },
  ]);
};

export const consumeStructuralChangeNotice = (instanceKey: string) => {
  writeNotices(readNotices().filter((notice) => notice.instanceKey !== instanceKey));
};

export const describeStructuralChange = (original: SetConfig[], modified: SetConfig[]) => {
  const before = normalizeSetConfigs(original);
  const after = normalizeSetConfigs(modified);
  const diff = after.length - before.length;
  if (diff > 0) return `Se añadieron ${diff} serie${diff === 1 ? '' : 's'}.`;
  if (diff < 0) return `Se eliminaron ${Math.abs(diff)} serie${Math.abs(diff) === 1 ? '' : 's'}.`;
  return 'No cambió el número de series.';
};