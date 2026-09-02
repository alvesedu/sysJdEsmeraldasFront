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
