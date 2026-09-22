import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertPdfUpload,
  buildCreditAllocationPayload,
  buildExpensePayload,
  buildGenerateChargesPayload,
  buildManualPaymentPayload,
  buildMonthlyClosingPayload,
  buildPayablePayload,
  buildResidentPayload,
  buildUnitPayload
} from './formWorkflows';
import type { Unit } from '../types/domain';

const unit: Unit = {
  _id: 'unit-1',
  quadra: 'A',
  numero: '10',
  tipo: 'CASA',
  status: 'ATIVA',
  monthlyValue: 25_000,
  unitKey: 'A-10-CASA'
};

describe('frontend operational form workflows', () => {
  it('builds unit creation payload and blocks duplicate quadra, numero and tipo', () => {
    assert.deepEqual(buildUnitPayload({ quadra: ' B ', numero: ' 12 ', tipo: 'LOTE', status: 'ATIVA' }, [unit]), {
      quadra: 'B',
      numero: '12',
      tipo: 'LOTE',
      status: 'ATIVA'
    });
    assert.throws(() => buildUnitPayload({ quadra: 'a', numero: '10', tipo: 'CASA', status: 'ATIVA' }, [unit]), /Já existe unidade/);
  });

  it('builds unit update payload without patrimonial identity fields', () => {
    assert.deepEqual(buildUnitPayload({ quadra: ' F ', numero: ' 22 ', tipo: 'LOTE', status: 'INATIVA' }, [unit], unit._id), {
      status: 'INATIVA'
    });
  });

  it('builds resident payload with optional unit link', () => {
    assert.deepEqual(buildResidentPayload({ name: ' Maria ', phone: '', email: 'maria@test.local', unitId: 'unit-1', active: true }), {
      name: 'Maria',
      phone: null,
      email: 'maria@test.local',
      unitId: 'unit-1',
      active: true
    });
  });

  it('builds charge generation payload from competence', () => {
    assert.deepEqual(buildGenerateChargesPayload('2026-09'), { competence: '2026-09' });
    assert.throws(() => buildGenerateChargesPayload('09/2026'), /YYYY-MM/);
  });

  it('converts payable money input to integer cents', () => {
    const payload = buildPayablePayload({
      description: ' Energia ',
      beneficiaryName: ' Equatorial ',
      categoryId: '507f1f77bcf86cd799439011',
      subcategory: '',
      competence: '2026-09',
      expectedAmount: '2.100,00',
      dueDate: '2026-09-10',
      notes: ''
    });
    assert.equal(payload.expectedAmount, 210_000);
    assert.equal(payload.notes, null);
  });

  it('builds manual payment payload in cents', () => {
    assert.deepEqual(buildManualPaymentPayload({ amount: '1810,50', paymentDate: '2026-09-12', notes: 'Pix' }), {
      amount: 181_050,
      paymentDate: '2026-09-12',
      notes: 'Pix'
    });
  });

  it('builds credit reconciliation allocation payload', () => {
    assert.deepEqual(buildCreditAllocationPayload('unit-1', [
      { chargeId: 'charge-1', amountText: '250,00' },
      { chargeId: 'charge-2', amountText: '' }
    ], true), {
      unitId: 'unit-1',
      allocations: [{ chargeId: 'charge-1', amount: 25_000 }],
      saveAlias: true
    });
  });

  it('validates bank upload file type and size', () => {
    assert.doesNotThrow(() => assertPdfUpload({ name: 'extrato.pdf', type: '', size: 1024 }));
    assert.throws(() => assertPdfUpload({ name: 'extrato.txt', type: 'text/plain', size: 1024 }), /PDF/);
    assert.throws(() => assertPdfUpload({ name: 'extrato.pdf', type: 'application/pdf', size: 11 * 1024 * 1024 }), /10 MB/);
  });

  it('builds expense classification payload without inventing an amount', () => {
    assert.deepEqual(buildExpensePayload({
      bankTransactionId: '507f1f77bcf86cd799439012',
      categoryId: '507f1f77bcf86cd799439011',
      beneficiary: 'Fornecedor',
      description: 'Manutenção',
      competence: '2026-09',
      notes: '',
      attachmentUrl: '',
      classificationStatus: 'CONFIRMED'
    }), {
      bankTransactionId: '507f1f77bcf86cd799439012',
      categoryId: '507f1f77bcf86cd799439011',
      beneficiary: 'Fornecedor',
      description: 'Manutenção',
      competence: '2026-09',
      notes: null,
      attachmentUrl: null,
      classificationStatus: 'CONFIRMED'
    });
  });

  it('builds monthly closing snapshot payload', () => {
    assert.deepEqual(buildMonthlyClosingPayload({ competence: '2026-09', notes: 'Fechamento validado' }), {
      competence: '2026-09',
      notes: 'Fechamento validado'
    });
  });
});
