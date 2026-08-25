import { BroodstockFish, FertilizationBatch, FishTransfer, LarvalBatch, ProcessingBatch } from '../types';

type NodeType = 'Pond' | 'Nursery' | 'Hatchery';
export interface TraceNode { type: NodeType; id: string; name?: string; viaTransferId?: string; date?: string; }
export interface LineageResult {
  nodes: TraceNode[];
  larvalBatch?: LarvalBatch;
  fertilization?: FertilizationBatch;
  mothers: BroodstockFish[];
  fathers: BroodstockFish[];
  complete: boolean;
  reason?: string;
}
export interface ProcessingTraceResult {
  found: boolean;
  processingBatch?: ProcessingBatch;
  lineages: LineageResult[];
  ambiguous: boolean;
  complete: boolean;
  reason?: string;
}

function dateMs(value?: string): number {
  const result = new Date(value || '').getTime();
  return Number.isFinite(result) ? result : Number.NEGATIVE_INFINITY;
}

function incomingTransfers(transfers: FishTransfer[], type: NodeType, id: string, asOf: number): FishTransfer[] {
  return transfers
    .filter((row) => row.status === 'COMPLETED' && row.destinationType === type && row.destinationId === id && dateMs(row.date) <= asOf)
    .sort((a, b) => dateMs(b.date) - dateMs(a.date));
}

function lineageFromLarva(batch: LarvalBatch | undefined, fertilizations: FertilizationBatch[], broodstock: BroodstockFish[], nodes: TraceNode[]): LineageResult {
  if (!batch) return { nodes, mothers: [], fathers: [], complete: false, reason: 'LARVAL_BATCH_NOT_FOUND' };
  const fertilization = fertilizations.find((row) => row.id === batch.fertilizationBatchId);
  if (!fertilization) return { nodes, larvalBatch: batch, mothers: [], fathers: [], complete: false, reason: 'FERTILIZATION_NOT_FOUND' };
  const mothers = broodstock.filter((fish) => fertilization.femaleIds.includes(fish.id));
  const fathers = broodstock.filter((fish) => fertilization.maleIds.includes(fish.id));
  const complete = mothers.length === fertilization.femaleIds.length && fathers.length === fertilization.maleIds.length && mothers.length > 0 && fathers.length > 0;
  return { nodes, larvalBatch: batch, fertilization, mothers, fathers, complete, reason: complete ? undefined : 'BROODSTOCK_REFERENCE_INCOMPLETE' };
}

function walkBack(
  node: TraceNode,
  transfers: FishTransfer[],
  larvae: LarvalBatch[],
  fertilizations: FertilizationBatch[],
  broodstock: BroodstockFish[],
  asOf: number,
  visited: Set<string>,
  path: TraceNode[],
  depth: number,
): LineageResult[] {
  const key = `${node.type}:${node.id}`;
  if (visited.has(key)) return [{ nodes: [...path, node], mothers: [], fathers: [], complete: false, reason: 'TRANSFER_LEDGER_CYCLE' }];
  if (depth > 12) return [{ nodes: [...path, node], mothers: [], fathers: [], complete: false, reason: 'TRACE_DEPTH_EXCEEDED' }];
  const nextVisited = new Set(visited); nextVisited.add(key);
  const nextPath = [...path, node];

  if (node.type === 'Hatchery') return [lineageFromLarva(larvae.find((batch) => batch.id === node.id), fertilizations, broodstock, nextPath)];

  const incoming = incomingTransfers(transfers, node.type, node.id, asOf);
  if (!incoming.length) {
    if (node.type === 'Nursery') {
      const batch = larvae.find((candidate) => candidate.currentTankId === node.id);
      if (batch) return [lineageFromLarva(batch, fertilizations, broodstock, nextPath)];
    }
    return [{ nodes: nextPath, mothers: [], fathers: [], complete: false, reason: 'UPSTREAM_TRANSFER_NOT_FOUND' }];
  }

  return incoming.flatMap((transfer) => walkBack(
    { type: transfer.sourceType, id: transfer.sourceId, name: transfer.sourceName, viaTransferId: transfer.id, date: transfer.date },
    transfers, larvae, fertilizations, broodstock, Math.min(asOf, dateMs(transfer.date)), nextVisited, nextPath, depth + 1,
  ));
}

export function traceProcessingToBroodstock(
  batchCode: string,
  processingBatches: ProcessingBatch[],
  transfers: FishTransfer[],
  larvae: LarvalBatch[],
  fertilizations: FertilizationBatch[],
  broodstock: BroodstockFish[],
): ProcessingTraceResult {
  const processingBatch = processingBatches.find((batch) => batch.batchCode.toLowerCase() === batchCode.trim().toLowerCase());
  if (!processingBatch) return { found: false, lineages: [], ambiguous: false, complete: false, reason: 'PROCESSING_BATCH_NOT_FOUND' };
  const asOf = dateMs(processingBatch.date);
  const lineages = walkBack({ type: 'Pond', id: processingBatch.sourcePondId, name: processingBatch.sourcePondName }, transfers, larvae, fertilizations, broodstock, asOf, new Set(), [], 0);
  const complete = lineages.length > 0 && lineages.every((lineage) => lineage.complete);
  return { found: true, processingBatch, lineages, ambiguous: lineages.length > 1, complete, reason: complete ? undefined : lineages[0]?.reason || 'TRACE_INCOMPLETE' };
}
