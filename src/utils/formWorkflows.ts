import { reaisInputToCents } from './money';
import type { Unit, UnitStatus, UnitType } from '../types/domain';

type UnitFormInput = { quadra: string; numero: string; tipo: UnitType; status: UnitStatus };
type ResidentFormInput = { name: string; phone: string; email: string; unitId: string; active: boolean };
type PayableFormInput = {
  description: string;
  beneficiaryName: string;
  categoryId: string;
  subcategory: string;
  competence: string;
  expectedAmount: string;
  dueDate: string;
  notes: string;
};
type PaymentFormInput = { amount: string; paymentDate: string; notes: string };
type AllocationInput = { chargeId: string; amountText: string };

export function buildUnitPayload(input: UnitFormInput, existingUnits: Unit[], editingId?: string | null) {
  const payload = {
    quadra: required(input.quadra, 'Quadra'),
    numero: required(input.numero, 'Número'),
    tipo: input.tipo,
    status: input.status
  };
  const duplicate = existingUnits.some((unit) => (
    unit._id !== editingId &&
    unit.quadra.trim().toLocaleUpperCase('pt-BR') === payload.quadra.toLocaleUpperCase('pt-BR') &&
    unit.numero.trim().toLocaleUpperCase('pt-BR') === payload.numero.toLocaleUpperCase('pt-BR') &&
    unit.tipo === payload.tipo
  ));
  if (duplicate) throw new Error('Já existe unidade com esta quadra, número e tipo.');
  return payload;
}

export function buildResidentPayload(input: ResidentFormInput) {
  return {
    name: required(input.name, 'Nome'),
    phone: optional(input.phone),
    email: optional(input.email),
    unitId: optional(input.unitId),
    active: input.active
  };
}

export function buildGenerateChargesPayload(competence: string) {
  if (!/^\d{4}-\d{2}$/.test(competence)) throw new Error('Informe a competência no formato YYYY-MM.');
  return { competence };
}

export function buildPayablePayload(input: PayableFormInput) {
  return {
    description: required(input.description, 'Descrição'),
    beneficiaryName: required(input.beneficiaryName, 'Favorecido'),
    categoryId: required(input.categoryId, 'Categoria'),
    subcategory: optional(input.subcategory),
    competence: buildGenerateChargesPayload(input.competence).competence,
    expectedAmount: reaisInputToCents(input.expectedAmount),
    dueDate: optional(input.dueDate),
    notes: optional(input.notes)
  };
}

export function buildManualPaymentPayload(input: PaymentFormInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paymentDate)) throw new Error('Informe a data do pagamento.');
  return {
    amount: reaisInputToCents(input.amount),
    paymentDate: input.paymentDate,
    notes: optional(input.notes)
  };
}

export function buildCreditAllocationPayload(unitId: string, allocations: AllocationInput[], saveAlias: boolean) {
  const parsedAllocations = allocations.flatMap((allocation) => {
    if (!allocation.amountText.trim()) return [];
    const amount = reaisInputToCents(allocation.amountText);
    return amount > 0 ? [{ chargeId: allocation.chargeId, amount }] : [];
  });
  if (!unitId) throw new Error('Selecione uma unidade.');
  if (parsedAllocations.length === 0) throw new Error('Informe ao menos um valor para conciliar.');
  return { unitId, allocations: parsedAllocations, saveAlias };
}

export function assertPdfUpload(file: Pick<File, 'name' | 'type' | 'size'>) {
  const isPdf = file.type === 'application/pdf' || file.name.toLocaleLowerCase('pt-BR').endsWith('.pdf');
  if (!isPdf) throw new Error('Envie um arquivo PDF.');
  if (file.size > 10 * 1024 * 1024) throw new Error('PDF excede o limite de 10 MB.');
}

function required(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} é obrigatório.`);
  return trimmed;
}

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}
