import { describe, expect, it } from 'vitest';
import { traceProcessingToBroodstock } from '../utils/traceabilityEngine';
import { BroodstockFish, FertilizationBatch, FishTransfer, LarvalBatch, ProcessingBatch } from '../types';

const mother = { id:'f1', chipNumber:'RF1', plateNumber:'P1', sex:'Female', speciesId:'sp', speciesName:'Beluga', geneticLine:'A', origin:'Farm', estimatedAgeYears:10, weightKg:50, lengthCm:150, maturityStage:'Stage IV (Ready)', status:'Active Broodstock', historyNotes:'' } as BroodstockFish;
const father = { ...mother, id:'m1', chipNumber:'RF2', plateNumber:'P2', sex:'Male' } as BroodstockFish;
const fertilization = { id:'fert1', batchCode:'FERT-1', date:'2026-01-01', femaleIds:['f1'], maleIds:['m1'], speciesId:'sp', speciesName:'Beluga', method:'Artificial Dry', totalEggWeightKg:2, estimatedEggCount:1000, spermVolumeMl:10, fertilizationRatePercent:90, fertilizationTimestamp:'2026-01-01T10:00:00Z', incubatorId:'inc1', operator:'op', status:'Hatched' } as FertilizationBatch;
const larva = { id:'larv1', batchCode:'LARV-1', fertilizationBatchId:'fert1', motherBroodstockIds:['f1'], fatherBroodstockIds:['m1'], speciesId:'sp', speciesName:'Beluga', hatchDate:'2026-01-10', larvalCount:1000, totalBiomassKg:1, survivalRatePercent:90, deformityPercent:1, initialFeedType:'Artemia Nauplii', destination:'Nursery', status:'Transferred' } as LarvalBatch;
const transfers = [
  { id:'t1', sourceType:'Hatchery', sourceId:'larv1', sourceName:'LARV-1', destinationType:'Nursery', destinationId:'n1', destinationName:'N1', speciesId:'sp', speciesName:'Beluga', fishCount:900, averageWeightKg:0.001, totalBiomassKg:0.9, date:'2026-02-01', operator:'op', reason:'grow', status:'COMPLETED' },
  { id:'t2', sourceType:'Nursery', sourceId:'n1', sourceName:'N1', destinationType:'Pond', destinationId:'p1', destinationName:'P1', speciesId:'sp', speciesName:'Beluga', fishCount:800, averageWeightKg:0.1, totalBiomassKg:80, date:'2026-05-01', operator:'op', reason:'grow', status:'COMPLETED' },
] as FishTransfer[];
const processing = [{ id:'proc1', batchCode:'PROC-1', date:'2026-08-01', sourcePondId:'p1', sourcePondName:'P1', speciesName:'Beluga', fishCount:10, liveBiomassKg:100, caviarYieldKg:10, caviarYieldPercent:10, caviarGrade:'Imperial Beluga (50g/100g)', filletMeatYieldKg:60, filletYieldPercent:60, smokedMeatYieldKg:20, byProductAndWasteKg:10, operatorName:'op', qualityScore:90, status:'Stored In Cold Room' }] as ProcessingBatch[];

describe('traceProcessingToBroodstock', () => {
  it('walks processing pond -> nursery -> hatchery -> fertilization -> parents', () => {
    const result = traceProcessingToBroodstock('PROC-1', processing, transfers, [larva], [fertilization], [mother, father]);
    expect(result.found).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.lineages[0].nodes.map((node) => node.type)).toEqual(['Pond','Nursery','Hatchery']);
    expect(result.lineages[0].mothers[0].id).toBe('f1');
    expect(result.lineages[0].fathers[0].id).toBe('m1');
  });

  it('does not invent lineage when the upstream transfer ledger is missing', () => {
    const result = traceProcessingToBroodstock('PROC-1', processing, [], [larva], [fertilization], [mother, father]);
    expect(result.complete).toBe(false);
    expect(result.reason).toBe('UPSTREAM_TRANSFER_NOT_FOUND');
  });
});
