import { useState, useEffect, useMemo } from 'react';
import { X, User, Calendar, Ruler, Scale, Users, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePersonalData } from '@/hooks/usePersonalData';
import { PersonalData, Sex, calculateAge } from '@/types/personalData';

interface PersonalDataFormProps {
  onClose: () => void;
}

const MONTHS = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

export const PersonalDataForm = ({ onClose }: PersonalDataFormProps) => {
  const { personalData, savePersonalData, clearPersonalData } = usePersonalData();
  
  // Estados separados para día, mes y año
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [sex, setSex] = useState<Sex>('masculino');

  // Generar años disponibles (desde 1920 hasta el año actual)
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsArray = [];
    for (let year = currentYear; year >= 1920; year--) {
      yearsArray.push(year.toString());
    }
    return yearsArray;
  }, []);

  // Generar días disponibles según el mes y año seleccionados
  const days = useMemo(() => {
    let maxDays = 31;
    
    if (birthMonth && birthYear) {
      const year = parseInt(birthYear);
      const month = parseInt(birthMonth);
      maxDays = new Date(year, month, 0).getDate();
    } else if (birthMonth) {
      // Si solo hay mes, usar máximo según el mes
      const month = parseInt(birthMonth);
      if ([4, 6, 9, 11].includes(month)) {
        maxDays = 30;
      } else if (month === 2) {
        maxDays = 29; // Por defecto permitir 29 para febrero
      }
    }
    
    const daysArray = [];
    for (let day = 1; day <= maxDays; day++) {
      daysArray.push(day.toString().padStart(2, '0'));
    }
    return daysArray;
  }, [birthMonth, birthYear]);

  // Construir fecha en formato ISO
  const birthDate = useMemo(() => {
    if (birthDay && birthMonth && birthYear) {
      return `${birthYear}-${birthMonth}-${birthDay}`;
    }
    return '';
  }, [birthDay, birthMonth, birthYear]);

  useEffect(() => {
    if (personalData) {
      // Parsear fecha existente
      const [year, month, day] = personalData.birthDate.split('-');
      setBirthYear(year || '');
      setBirthMonth(month || '');
      setBirthDay(day || '');
      setHeight(personalData.height.toString());
      setWeight(personalData.weight.toString());
      setSex(personalData.sex);
    }
  }, [personalData]);

  // Ajustar el día si excede el máximo para el mes/año seleccionado
  useEffect(() => {
    if (birthDay && days.length > 0) {
      const maxDay = days[days.length - 1];
      if (parseInt(birthDay) > parseInt(maxDay)) {
        setBirthDay(maxDay);
      }
    }
  }, [birthMonth, birthYear, days, birthDay]);

  const handleSave = () => {
    if (!birthDate || !height || !weight) {
      return;
    }

    const data: PersonalData = {
      birthDate,
      height: parseFloat(height),
      weight: parseFloat(weight),
      sex,
    };

    savePersonalData(data);
    onClose();
  };

  const handleClear = () => {
    if (confirm('¿Estás seguro de eliminar tus datos personales?')) {
      clearPersonalData();
      setBirthDay('');
      setBirthMonth('');
      setBirthYear('');
      setHeight('');
      setWeight('');
      setSex('masculino');
    }
  };

  const age = birthDate ? calculateAge(birthDate) : null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">Datos Personales</h2>
              <p className="text-xs text-muted-foreground">Tu perfil de entrenamiento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-5">
          {/* Fecha de nacimiento */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="w-4 h-4 text-primary" />
              Fecha de nacimiento
            </Label>
            
            <div className="grid grid-cols-3 gap-2">
              {/* Día */}
              <Select value={birthDay} onValueChange={setBirthDay}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Día" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] bg-card border-border z-[100]">
                  {days.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Mes */}
              <Select value={birthMonth} onValueChange={setBirthMonth}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] bg-card border-border z-[100]">
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Año */}
              <Select value={birthYear} onValueChange={setBirthYear}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] bg-card border-border z-[100]">
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {age !== null && age > 0 && (
              <p className="text-sm text-primary font-medium">
                Edad: {age} años
              </p>
            )}
          </div>

          {/* Altura */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Ruler className="w-4 h-4 text-primary" />
              Altura (cm)
            </Label>
            <Input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="175"
              min="100"
              max="250"
              step="1"
              className="bg-secondary border-border"
            />
          </div>

          {/* Peso */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Scale className="w-4 h-4 text-primary" />
              Peso (kg)
            </Label>
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="70"
              min="30"
              max="300"
              step="0.5"
              className="bg-secondary border-border"
            />
          </div>

          {/* Sexo */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Users className="w-4 h-4 text-primary" />
              Sexo
            </Label>
            <RadioGroup
              value={sex}
              onValueChange={(value) => setSex(value as Sex)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="masculino" id="masculino" />
                <Label htmlFor="masculino" className="cursor-pointer">Masculino</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="femenino" id="femenino" />
                <Label htmlFor="femenino" className="cursor-pointer">Femenino</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Resumen si hay datos */}
          {personalData && (
            <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">Resumen actual</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Edad:</span>
                  <span className="ml-2 font-medium">{calculateAge(personalData.birthDate)} años</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Sexo:</span>
                  <span className="ml-2 font-medium capitalize">{personalData.sex}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Altura:</span>
                  <span className="ml-2 font-medium">{personalData.height} cm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Peso:</span>
                  <span className="ml-2 font-medium">{personalData.weight} kg</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-card/95 backdrop-blur-sm border-t border-border p-4 flex gap-3">
          {personalData && (
            <Button
              variant="outline"
              onClick={handleClear}
              className="flex-1 gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!birthDate || !height || !weight}
            className="flex-1 gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
};
