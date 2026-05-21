'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { ClickPesa, ClickPesaWebhook, ClickPesaClient } = require('../index');

// ─── ClickPesaClient ─────────────────────────────────────────────────────────

describe('ClickPesaClient', () => {
  test('throws when clientId is missing', () => {
    assert.throws(() => new ClickPesaClient({ clientSecret: 'sec' }), /clientId/);
  });

  test('throws when clientSecret is missing', () => {
    assert.throws(() => new ClickPesaClient({ clientId: 'id' }), /clientSecret/);
  });

  test('constructs with valid config and correct default baseUrl', () => {
    const c = new ClickPesaClient({ clientId: 'id', clientSecret: 'sec' });
    assert.equal(c.clientId, 'id');
    assert.equal(c.baseUrl, 'https://api.clickpesa.com/third-parties');
  });

  test('strips trailing slash from baseUrl', () => {
    const c = new ClickPesaClient({ clientId: 'id', clientSecret: 'sec', baseUrl: 'https://api.example.com/' });
    assert.equal(c.baseUrl, 'https://api.example.com');
  });
});

// ─── ClickPesa — input validation ────────────────────────────────────────────

describe('ClickPesa — initiateUSSD validation', () => {
  let cp;
  beforeEach(() => { cp = new ClickPesa({ clientId: 'id', clientSecret: 'sec' }); });

  test('rejects missing phoneNumber', async () => {
    await assert.rejects(
      () => cp.initiateUSSD({ amount: 100, orderReference: 'REF', checksum: 'cs' }),
      /phoneNumber/
    );
  });

  test('rejects missing amount', async () => {
    await assert.rejects(
      () => cp.initiateUSSD({ phoneNumber: '255700000000', orderReference: 'REF', checksum: 'cs' }),
      /amount/
    );
  });

  test('rejects missing orderReference', async () => {
    await assert.rejects(
      () => cp.initiateUSSD({ phoneNumber: '255700000000', amount: 100, checksum: 'cs' }),
      /orderReference/
    );
  });

  test('rejects missing checksum', async () => {
    await assert.rejects(
      () => cp.initiateUSSD({ phoneNumber: '255700000000', amount: 100, orderReference: 'REF' }),
      /checksum/
    );
  });
});

describe('ClickPesa — initiateCardPayment validation', () => {
  let cp;
  beforeEach(() => { cp = new ClickPesa({ clientId: 'id', clientSecret: 'sec' }); });

  test('rejects missing amount', async () => {
    await assert.rejects(
      () => cp.initiateCardPayment({ orderReference: 'REF', checksum: 'cs' }),
      /amount/
    );
  });

  test('rejects missing orderReference', async () => {
    await assert.rejects(
      () => cp.initiateCardPayment({ amount: 500, checksum: 'cs' }),
      /orderReference/
    );
  });

  test('rejects missing checksum', async () => {
    await assert.rejects(
      () => cp.initiateCardPayment({ amount: 500, orderReference: 'REF' }),
      /checksum/
    );
  });
});

describe('ClickPesa — queryStatus validation', () => {
  let cp;
  beforeEach(() => { cp = new ClickPesa({ clientId: 'id', clientSecret: 'sec' }); });

  test('rejects missing orderReference', async () => {
    await assert.rejects(() => cp.queryStatus(), /orderReference/);
  });
});

// ─── ClickPesa — correct endpoints ───────────────────────────────────────────

describe('ClickPesa — endpoint routing', () => {
  function makeStubCp(capturePost, captureGet) {
    const cp = new ClickPesa({ clientId: 'id', clientSecret: 'sec' });
    cp.client.post = async (path, body) => { capturePost({ path, body }); return {}; };
    cp.client.get  = async (path)       => { captureGet(path); return {}; };
    return cp;
  }

  test('initiateUSSD posts to /payments/initiate-ussd-push-request', async () => {
    let captured;
    const cp = makeStubCp(c => { captured = c; }, () => {});
    await cp.initiateUSSD({ phoneNumber: '255712345678', amount: 1000, orderReference: 'O1', checksum: 'cs' });
    assert.equal(captured.path, '/payments/initiate-ussd-push-request');
    assert.equal(captured.body.phoneNumber, '255712345678');
    assert.equal(captured.body.orderReference, 'O1');
    assert.equal(captured.body.checksum, 'cs');
    assert.equal('currency' in captured.body, false); // USSD has no currency field
  });

  test('initiateCardPayment posts to /payments/initiate-card-payment', async () => {
    let captured;
    const cp = makeStubCp(c => { captured = c; }, () => {});
    await cp.initiateCardPayment({
      amount: 5000, currency: 'TZS', orderReference: 'O2',
      customer: { id: 'CUST-001' }, checksum: 'cs',
    });
    assert.equal(captured.path, '/payments/initiate-card-payment');
    assert.equal(captured.body.orderReference, 'O2');
    assert.deepEqual(captured.body.customer, { id: 'CUST-001' });
  });

  test('initiateCardPayment omits customer when not provided', async () => {
    let captured;
    const cp = makeStubCp(c => { captured = c; }, () => {});
    await cp.initiateCardPayment({ amount: 500, orderReference: 'O3', checksum: 'cs' });
    assert.equal('customer' in captured.body, false);
  });

  test('queryStatus gets /payments/{orderReference}', async () => {
    let capturedPath;
    const cp = makeStubCp(() => {}, p => { capturedPath = p; });
    await cp.queryStatus('ORDER-001');
    assert.equal(capturedPath, '/payments/ORDER-001');
  });

  test('getBalance gets /account/balance', async () => {
    let capturedPath;
    const cp = makeStubCp(() => {}, p => { capturedPath = p; });
    await cp.getBalance();
    assert.equal(capturedPath, '/account/balance');
  });
});

// ─── ClickPesaWebhook ─────────────────────────────────────────────────────────

describe('ClickPesaWebhook.parse', () => {
  test('parses snake_case payload', () => {
    const event = ClickPesaWebhook.parse({
      transaction_id: 'TX999',
      reference_id: 'ORDER-1',
      status: 'successful',
      amount: '5000',
      currency: 'TZS',
      payment_method: 'ussd',
      phone_number: '255712345678',
    });
    assert.equal(event.transactionId, 'TX999');
    assert.equal(event.reference, 'ORDER-1');
    assert.equal(event.status, 'successful');
    assert.equal(event.amount, 5000);
    assert.equal(event.currency, 'TZS');
    assert.equal(event.paymentMethod, 'ussd');
    assert.equal(event.phone, '255712345678');
  });

  test('handles camelCase payload', () => {
    const event = ClickPesaWebhook.parse({ transactionId: 'TX888', status: 'failed' });
    assert.equal(event.transactionId, 'TX888');
    assert.equal(event.status, 'failed');
  });

  test('returns nulls for empty payload', () => {
    const event = ClickPesaWebhook.parse({});
    assert.equal(event.transactionId, null);
    assert.equal(event.status, null);
  });

  test('raw contains original body', () => {
    const body = { foo: 'bar' };
    assert.deepEqual(ClickPesaWebhook.parse(body).raw, body);
  });
});

describe('ClickPesaWebhook.verify', () => {
  test('returns false for missing arguments', () => {
    assert.equal(ClickPesaWebhook.verify('', '', ''), false);
    assert.equal(ClickPesaWebhook.verify(null, null, null), false);
  });

  test('verifies a valid HMAC-SHA256 signature', () => {
    const crypto = require('crypto');
    const secret = 'my-webhook-secret';
    const body = '{"status":"successful"}';
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    assert.equal(ClickPesaWebhook.verify(body, sig, secret), true);
  });

  test('rejects a tampered signature', () => {
    assert.equal(ClickPesaWebhook.verify('body', 'bad-sig', 'secret'), false);
  });
});
