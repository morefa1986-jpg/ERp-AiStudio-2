import type { Hall, Pond, SturgeonSpecies } from './index';
import type { PondShape } from './pondSnapshot';

export interface FarmSpeciesWithStatus extends SturgeonSpecies {
  isActive?: boolean;
}

export interface HallAdminInput {
  number: string;
  name: string;
  description: string;
}

export interface PondStructureAdminInput {
  number: string;
  name: string;
  hallId: string;
  speciesId: string;
  pondShape: PondShape;
  capacityCubicMeters?: number;
  lengthMeters?: number;
  widthMeters?: number;
  depthMeters?: number;
  diameterMeters?: number;
  notes?: string;
}

export interface SpeciesAdminInput extends Omit<SturgeonSpecies, 'id'> {
  isActive?: boolean;
}

export type HallAdminPatch = Partial<Pick<Hall, 'number' | 'name' | 'description' | 'managerId' | 'isActive'>>;
export type PondAdminPatch = Partial<Pick<Pond, 'number' | 'name' | 'hallId' | 'speciesId' | 'notes'>> & {
  pondShape?: PondShape;
  capacityCubicMeters?: number;
  lengthMeters?: number;
  widthMeters?: number;
  depthMeters?: number;
  diameterMeters?: number;
};
