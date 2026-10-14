import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseQuickPaymentText } from './quickEntryParser';

describe('quick payment entry parser', () => {
  it('detects paid marker, payer, amount and period hints from WhatsApp lines', () => {
    const [item] = parseQuickPaymentText('7 - Amadeu/Dulce✅125,00');

    assert.equal(item.lineNumber, 1);
    assert.equal(item.sequence, '7');
    assert.equal(item.payerName, 'Amadeu/Dulce');
    assert.equal(item.paid, true);
    assert.equal(item.amountCents, 12_500);
    assert.equal(item.amountText, '125,00');
  });

  it('keeps future or multi-month notes for manual review', () => {
    const [item] = parseQuickPaymentText('10 - Carlos Soares✅(até maio 2027)');

    assert.equal(item.payerName, 'Carlos Soares');
    assert.equal(item.paid, true);
    assert.deepEqual(item.periodHints, ['maio']);
    assert.equal(item.amountCents, null);
  });

  it('parses multiple lines without creating payments automatically', () => {
    const items = parseQuickPaymentText([
      '2 - Alan Maicon ✅',
      '24 - Evonildo Qd G Lt 4/5 casa, Qd F Lt 9 construção',
      '70 - Outros aluguel do salão✅200,00'
    ].join('\n'));

    assert.equal(items.length, 3);
    assert.equal(items[0].paid, true);
    assert.equal(items[1].paid, false);
    assert.equal(items[2].amountCents, 20_000);
  });
});
