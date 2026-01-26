import { Exercise } from './exercise';

export interface Routine {
  id: string;
  name: string;
  exerciseIds: string[];
  createdAt: Date;
}
