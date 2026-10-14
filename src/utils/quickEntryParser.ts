import { reaisInputToCents } from './money';

export type QuickEntryDraft = {
  lineNumber: number;
  rawText: string;
  sequence: string | null;
  payerName: string;
  paid: boolean;
  amountCents: number | null;
  amountText: string | null;
  periodHints: string[];
  notes: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  suggestedResidentId?: string | { _id: string; name: string } | null;
  suggestedUnitId?: string | { _id: string; quadra: string; numero: string; tipo: 'CASA' | 'LOTE' } | null;
  suggestionConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  suggestionReason?: string | null;
  confirmedChargeId?: string | ChargeReference | null;
  confirmedPaymentAllocationId?: string | null;
  confirmedAt?: string | null;
};

type ChargeReference = { _id: string; competence: string; openBalance: number; status: string };

const amountPattern = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/gi;
const monthPattern = /\b(jan(?:eiro)?|fev(?:ereiro)?|mar(?:ço|co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\b/gi;

export function parseQuickPaymentText(input: string): QuickEntryDraft[] {
  return input
    .split(/\r?\n/)
    .map((line, index) => parseLine(line, index + 1))
    .filter((item): item is QuickEntryDraft => item !== null);
}

function parseLine(line: string, lineNumber: number): QuickEntryDraft | null {
  const rawText = line.trim();
  if (!rawText) return null;

  const sequenceMatch = rawText.match(/^(\d+)\s*[-.)]?\s*(.*)$/);
  const sequence = sequenceMatch?.[1] ?? null;
  const body = (sequenceMatch?.[2] ?? rawText).trim();
  if (!body) return null;

  const paid = /✅|☑|✔/.test(body);
  const amountText = lastAmount(body);
  const amountCents = amountText ? safeMoneyToCents(amountText) : null;
  const periodHints = Array.from(new Set(body.match(monthPattern)?.map((value) => value.toLocaleLowerCase('pt-BR')) ?? []));
  const payerName = extractPayerName(body);
  const confidence: QuickEntryDraft['confidence'] = paid && payerName && amountCents !== null
    ? 'HIGH'
    : paid || payerName
      ? 'MEDIUM'
      : 'LOW';

  return {
    lineNumber,
    rawText,
    sequence,
    payerName,
    paid,
    amountCents,
    amountText,
    periodHints,
    notes: body,
    confidence
  };
}

function extractPayerName(body: string) {
  const beforeCheck = body.split(/[✅☑✔]/)[0] ?? body;
  const withoutAmount = beforeCheck.replace(amountPattern, '');
  const withoutUnitHint = withoutAmount
    .replace(/\b(qd|quadra)\b.*$/i, '')
    .replace(/\blt\b.*$/i, '')
    .replace(/\bcasa\b.*$/i, '');
  return withoutUnitHint.replace(/[;,:()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
}

function lastAmount(value: string) {
  const matches = Array.from(value.matchAll(amountPattern));
  const match = matches.at(-1);
  return match ? `${match[1]},${match[2]}` : null;
}

function safeMoneyToCents(value: string) {
  try {
    return reaisInputToCents(value);
  } catch {
    return null;
  }
}
