import jsPDF from 'jspdf';
import { WorkoutSession } from '@/types/workoutHistory';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ExportData {
  routineName: string;
  date: Date;
  durationSeconds: number;
  totalKg?: number;
  calories?: number;
  exercises: {
    name: string;
    muscleGroup: string;
    sets: { setNumber: number; reps: number; weight: number; restTime?: number }[];
  }[];
}

const formatDuration = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

export const exportWorkoutToPDF = (data: ExportData) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageW, 70, 'F');
  doc.setTextColor(132, 204, 22); // lime
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('GYM ASSESSOR', margin, 32);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Resumen de entrenamiento', margin, 52);
  y = 90;

  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(data.routineName, margin, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(format(data.date, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }), margin, y);
  y += 24;

  // Stats box
  const stats: string[] = [];
  stats.push(`Duración: ${formatDuration(data.durationSeconds)}`);
  if (data.totalKg !== undefined) stats.push(`Kg movidos: ${data.totalKg.toLocaleString()} kg`);
  if (data.calories !== undefined && data.calories > 0) stats.push(`Calorías: ${data.calories} kcal`);
  stats.push(`Ejercicios: ${data.exercises.length}`);

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(margin, y, pageW - margin * 2, 50, 6, 6, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  const colW = (pageW - margin * 2) / stats.length;
  stats.forEach((s, i) => {
    const [label, value] = s.split(': ');
    const cx = margin + colW * i + colW / 2;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(label, cx, y + 18, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(value, cx, y + 36, { align: 'center' });
  });
  y += 70;

  // Exercises
  data.exercises.forEach((ex, idx) => {
    ensureSpace(60);
    doc.setFillColor(132, 204, 22);
    doc.rect(margin, y, 4, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(`${idx + 1}. ${ex.name}`, margin + 12, y + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(ex.muscleGroup, pageW - margin, y + 14, { align: 'right' });
    y += 24;

    // Table header
    ensureSpace(20);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, pageW - margin * 2, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const c1 = margin + 10;
    const c2 = margin + 100;
    const c3 = margin + 220;
    const c4 = margin + 340;
    doc.text('Serie', c1, y + 12);
    doc.text('Reps', c2, y + 12);
    doc.text('Peso (kg)', c3, y + 12);
    doc.text('Descanso', c4, y + 12);
    y += 18;

    ex.sets.forEach((set) => {
      ensureSpace(16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`#${set.setNumber}`, c1, y + 12);
      doc.text(`${set.reps}`, c2, y + 12);
      doc.text(`${set.weight}`, c3, y + 12);
      doc.text(set.restTime !== undefined ? `${set.restTime}s` : '-', c4, y + 12);
      doc.setDrawColor(230, 230, 230);
      doc.line(margin, y + 16, pageW - margin, y + 16);
      y += 16;
    });

    y += 12;
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Gym Assessor · página ${i} de ${pageCount}`, pageW / 2, pageH - 20, { align: 'center' });
  }

  const safeName = data.routineName.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  const dateStr = format(data.date, 'yyyy-MM-dd');
  doc.save(`entrenamiento_${safeName}_${dateStr}.pdf`);
};

export const exportSessionFromHistory = (session: WorkoutSession) => {
  const totalKg = session.exercises.reduce(
    (acc, e) => acc + e.completedSets.reduce((s, set) => s + set.weight * set.reps, 0),
    0
  );
  exportWorkoutToPDF({
    routineName: session.routineName || 'Entrenamiento libre',
    date: new Date(session.date),
    durationSeconds: session.totalDuration,
    totalKg,
    exercises: session.exercises.map(e => ({
      name: e.exerciseName,
      muscleGroup: e.muscleGroup,
      sets: e.completedSets.map(s => ({
        setNumber: s.setNumber,
        reps: s.reps,
        weight: s.weight,
        restTime: s.restTime,
      })),
    })),
  });
};
