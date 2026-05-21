'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const ClickPesaPayout = require('../src/ClickPesaPayout');

// Minimal stub client — we only test validation, not network
function stubClient() {
  return {
    post: async () => ({ ok: true }),
    get:  async () => ({ ok: true }),
  };
}

describe('ClickPesaPayout — previewMNOPayout', () => {
  test('rejects missing amount', async () => {
    const p = new ClickPesaPayout(stubClient());
    await assert.rejects(
      () => p.previewMNOPayout({ phoneNumber: '255700000000', orderReference: 'R1' }),
      /amount/
    );
  });

  test('rejects missing phoneNumber', async () => {
    const p = new ClickPesaPayout(stubClient());
    await assert.rejects(
      () => p.previewMNOPayout({ amount: 100, orderReference: 'R1' }),
      /phoneNumber/
    );
  });

  test('rejects missing orderReference', async () => {
    const p = new ClickPesaPayout(stubClient());
    await assert.rejects(
      () => p.previewMNOPayout({ amount: 100, phoneNumber: '255700000000' }),
      /orderReference/
    );
  });

  test('passes with valid params', async () => {
    let captured;
    const client = { post: async (path, body) => { captured = { path, body }; return {}; } };
    const p = new ClickPesaPayout(client);
    await p.previewMNOPayout({ amount: 1000, phoneNumber: '255712345678', currency: 'TZS', orderReference: 'P-001' });
    assert.equal(captured.path, '/third-parties/payouts/preview-mobile-money-payout');
    assert.equal(captured.body.amount, 1000);
    assert.equal(captured.body.phoneNumber, '255712345678');
    assert.equal(captured.body.currency, 'TZS');
    assert.equal(captured.body.orderReference, 'P-001');
  });

  test('omits checksum when not provided', async () => {
    let captured;
    const client = { post: async (_, body) => { captured = body; return {}; } };
    const p = new ClickPesaPayout(client);
    await p.previewMNOPayout({ amount: 500, phoneNumber: '255712345678', orderReference: 'P-002' });
    assert.equal('checksum' in captured, false);
  });

  test('includes checksum when provided', async () => {
    let captured;
    const client = { post: async (_, body) => { captured = body; return {}; } };
    const p = new ClickPesaPayout(client);
    await p.previewMNOPayout({ amount: 500, phoneNumber: '255712345678', orderReference: 'P-003', checksum: 'abc123' });
    assert.equal(captured.checksum, 'abc123');
  });
});

describe('ClickPesaPayout — createMNOPayout', () => {
  test('rejects missing amount', async () => {
    const p = new ClickPesaPayout(stubClient());
    await assert.rejects(
      () => p.createMNOPayout({ phoneNumber: '255700000000', orderReference: 'R1' }),
      /amount/
    );
  });

  test('sends to correct endpoint', async () => {
    let capturedPath;
    const client = { post: async (path) => { capturedPath = path; return {}; } };
    const p = new ClickPesaPayout(client);
    await p.createMNOPayout({ amount: 1000, phoneNumber: '255712345678', orderReference: 'P-004' });
    assert.equal(capturedPath, '/third-parties/payouts/create-mobile-money-payout');
  });
});

describe('ClickPesaPayout — previewBankPayout', () => {
  const validBankParams = {
    amount: 20000, accountNumber: '123456789',
    orderReference: 'BP-001', bic: 'EQBLTZTZ', transferType: 'ACH',
  };

  test('rejects missing bic', async () => {
    const p = new ClickPesaPayout(stubClient());
    const { bic, ...rest } = validBankParams;
    await assert.rejects(() => p.previewBankPayout(rest), /bic/);
  });

  test('rejects missing transferType when explicitly empty', async () => {
    const p = new ClickPesaPayout(stubClient());
    const { transferType, ...rest } = validBankParams;
    // transferType has a default ('ACH'), so this should NOT throw — it uses the default
    const result = await p.previewBankPayout(rest);
    assert.ok(result);
  });

  test('sends to correct endpoint with defaults', async () => {
    let captured;
    const client = { post: async (path, body) => { captured = { path, body }; return {}; } };
    const p = new ClickPesaPayout(client);
    await p.previewBankPayout(validBankParams);
    assert.equal(captured.path, '/third-parties/payouts/preview-bank-payout');
    assert.equal(captured.body.accountCurrency, 'TZS');
  });
});

describe('ClickPesaPayout — createBankPayout', () => {
  test('rejects missing accountName', async () => {
    const p = new ClickPesaPayout(stubClient());
    await assert.rejects(
      () => p.createBankPayout({
        amount: 20000, accountNumber: '123456789',
        orderReference: 'BP-002', bic: 'EQBLTZTZ', transferType: 'ACH',
      }),
      /accountName/
    );
  });

  test('sends to correct endpoint', async () => {
    let capturedPath;
    const client = { post: async (path) => { capturedPath = path; return {}; } };
    const p = new ClickPesaPayout(client);
    await p.createBankPayout({
      amount: 20000, accountNumber: '123456789', accountName: 'John Doe',
      orderReference: 'BP-003', bic: 'EQBLTZTZ', transferType: 'RTGS',
    });
    assert.equal(capturedPath, '/third-parties/payouts/create-bank-payout');
  });
});

describe('ClickPesaPayout — queryPayoutStatus', () => {
  test('rejects missing orderReference', async () => {
    const p = new ClickPesaPayout(stubClient());
    await assert.rejects(() => p.queryPayoutStatus(), /orderReference/);
  });

  test('builds correct URL with encoded reference', async () => {
    let capturedPath;
    const client = { get: async (path) => { capturedPath = path; return []; } };
    const p = new ClickPesaPayout(client);
    await p.queryPayoutStatus('ORDER/001');
    assert.equal(capturedPath, '/third-parties/payouts/ORDER%2F001');
  });
});

describe('ClickPesaPayout — queryAllPayouts', () => {
  test('sends to /payouts/all with no params', async () => {
    let capturedPath;
    const client = { get: async (path) => { capturedPath = path; return {}; } };
    const p = new ClickPesaPayout(client);
    await p.queryAllPayouts();
    assert.equal(capturedPath, '/third-parties/payouts/all?orderBy=DESC&skip=0&limit=20');
  });

  test('appends filter params as query string', async () => {
    let capturedPath;
    const client = { get: async (path) => { capturedPath = path; return {}; } };
    const p = new ClickPesaPayout(client);
    await p.queryAllPayouts({ status: 'SUCCESS', channel: 'MOBILE MONEY', limit: 5 });
    assert.ok(capturedPath.includes('status=SUCCESS'));
    assert.ok(capturedPath.includes('channel=MOBILE%20MONEY'));
    assert.ok(capturedPath.includes('limit=5'));
  });
});

describe('ClickPesaPayout — getBankList', () => {
  test('calls /list/banks', async () => {
    let capturedPath;
    const client = { get: async (path) => { capturedPath = path; return []; } };
    const p = new ClickPesaPayout(client);
    await p.getBankList();
    assert.equal(capturedPath, '/third-parties/list/banks');
  });
});
