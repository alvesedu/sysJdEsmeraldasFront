export type UnitType = 'CASA' | 'LOTE';
export type UnitStatus = 'ATIVA' | 'INATIVA';

export type Resident = {
  _id: string;
  name: string;
  phone: string | null;
  email: string | null;
  unitId?: Unit | string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Unit = {
  _id: string;
  quadra: string;
  numero: string;
  tipo: UnitType;
  status: UnitStatus;
  monthlyValue: number;
  unitKey: string;
  residentCurrentId?: Resident | null;
  residentHistory?: Array<{ residentId: string | Resident; startedAt: string; endedAt: string | null }>;
  createdAt?: string;
};

export type ChargeStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'PAID_AFTER_REFERENCE_DATE';

export type Charge = {
  _id: string;
  unitId: Unit | string;
  competence: string;
  valueOriginal: number;
  valuePaid: number;
  openBalance: number;
  referenceDate: string;
  status: ChargeStatus;
};

export type Category = {
  _id: string;
  name: string;
  active: boolean;
  defaultCounterpartyPattern: string | null;
};

export type BankTransaction = {
  _id: string;
  postingDate: string;
  operationDate: string | null;
  description: string;
  counterpartyOriginalName: string | null;
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  transactionType: string;
};

export type AuditLog = {
  _id: string;
  userId: { _id: string; name?: string; email?: string } | string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type Expense = {
  _id: string;
  bankTransactionId: BankTransaction | string | null;
  categoryId: Category | string;
  beneficiary: string;
  description: string;
  competence: string;
  notes: string | null;
  attachmentUrl: string | null;
  classificationStatus: 'PENDING' | 'SUGGESTED' | 'CONFIRMED';
  createdAt?: string;
  updatedAt?: string;
};

export type MonthlyClosing = {
  _id: string;
  competence: string;
  status: 'OPEN' | 'CLOSED';
  revenueForecast: number;
  revenueReceived: number;
  revenueReceivedBeforeRef: number;
  revenueReceivedAfterRef: number;
  revenuePending: number;
  pendingUnitsCount: number;
  expenseForecast: number;
  expensePaid: number;
  openingBankBalance: number;
  bankInflow: number;
  bankOutflow: number;
  closingBankBalance: number;
  openCommitments: number;
  availableBalance: number;
  notes: string | null;
};
