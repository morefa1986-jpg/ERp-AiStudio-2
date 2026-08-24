import type { Pond } from './index';

export type PondShape = 'Circular' | 'Rectangular' | 'Raceway' | 'Other';

export interface PondSpeciesManualGroup {
  speciesId: string;
  count: number;
  avgWeightKg: number;
  maleCount: number;
  femaleCount: number;
  unknownSexCount: number;
  chipNumbers?: string[];
}

export interface PondManualSnapshotInput {
  speciesMix: PondSpeciesManualGroup[];
  manualWaterTemperature: number;
  pondShape?: PondShape;
  lengthMeters?: number;
  widthMeters?: number;
  depthMeters?: number;
  diameterMeters?: number;
  stopFeeding: boolean;
  notes: string;
}

export interface PondManualSnapshotFields {
  speciesMix?: PondSpeciesManualGroup[];
  manualWaterTemperature?: number;
  pondShape?: PondShape;
  lengthMeters?: number;
  widthMeters?: number;
  depthMeters?: number;
  diameterMeters?: number;
  lastManualSnapshotAt?: string;
  lastManualSnapshotBy?: string;
  manualSnapshotNotes?: string;
}

export type PondWithManualSnapshot = Omit<Pond, 'speciesMix'> & PondManualSnapshotFields;

export function pondWithManualSnapshot(pond: Pond): PondWithManualSnapshot {
  return pond as PondWithManualSnapshot;
}

export function manualSnapshotCapacityCubicMeters(input: PondManualSnapshotInput, fallback: number): number {
  const depth = Number(input.depthMeters);
  if (!Number.isFinite(depth) || depth <= 0) return fallback;

  if (input.pondShape === 'Circular') {
    const diameter = Number(input.diameterMeters);
    if (!Number.isFinite(diameter) || diameter <= 0) return fallback;
    return Number((Math.PI * Math.pow(diameter / 2, 2) * depth).toFixed(2));
  }

  if (input.pondShape === 'Rectangular' || input.pondShape === 'Raceway') {
    const length = Number(input.lengthMeters);
    const width = Number(input.widthMeters);
    if (!Number.isFinite(length) || length <= 0 || !Number.isFinite(width) || width <= 0) return fallback;
    return Number((length * width * depth).toFixed(2));
  }

  return fallback;
}
