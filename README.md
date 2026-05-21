# clickpesa

Node.js SDK for the [ClickPesa](https://clickpesa.com) payment platform — a direct port of the [Laravel/PHP package](https://github.com/emilkitua93/clickpesa) by Emil Kitua.

Zero runtime dependencies. Works with Node.js 14+.

## Features

- Token authentication (automatic, with caching + auto-refresh)
- USSD (mobile money) checkout — Mpesa, TigoPesa, AirtelMoney, etc.
- Card payment initiation
- Payment status query
- Wallet balance retrieval
- Webhook parsing and HMAC-SHA256 signature verification
- Payouts: mobile money (MNO) and bank disbursements
- Full TypeScript definitions included

---

## Installation

```bash
npm install clickpesa
```

---

## Quick start

```js
const { ClickPesa } = require('clickpesa');

const clickpesa = new ClickPesa({
  clientId: process.env.CLICKPESA_CLIENT_ID,
  clientSecret: process.env.CLICKPESA_CLIENT_SECRET,
  baseUrl: 'https://api.clickpesa.com/third-parties', // default
});
```

---

## API

### `new ClickPesa(config)`

| Option         | Type   | Default                                        | Description                   |
| -------------- | ------ | ---------------------------------------------- | ----------------------------- |
| `clientId`     | string | **required**                                   | ClickPesa OAuth client ID     |
| `clientSecret` | string | **required**                                   | ClickPesa OAuth client secret |
| `baseUrl`      | string | `https://api.clickpesa.com/third-parties`      | API base URL                  |
| `timeout`      | number | `30000`                                        | HTTP timeout (ms)             |

---

### `clickpesa.initiateUSSD(params)`

Initiate a USSD (mobile money) checkout.

```js
const result = await clickpesa.initiateUSSD({
  phoneNumber: '255712345678',              // E.164 format without '+'
  amount: 1000,
  orderReference: 'ORDER-001',             // unique ID from your system
  checksum: '<your-secret-key>',
});
// result: { transaction_id: 'TX123456', status: 'pending', ... }
```

---

### `clickpesa.initiateCardPayment(params)`

Initiate a card payment checkout.

```js
const result = await clickpesa.initiateCardPayment({
  amount: 5000,
  currency: 'TZS',                         // default
  orderReference: 'ORDER-002',
  customer: { id: 'CUST-001' },            // optional
  checksum: '<your-secret-key>',
});
```

---

### `clickpesa.queryStatus(orderReference)`

Query payment status by order reference.

```js
const status = await clickpesa.queryStatus('ORDER-001');
// { status: 'successful', amount: 1000, ... }
```

---

### `clickpesa.getBalance()`

Retrieve your ClickPesa account balance.

```js
const balance = await clickpesa.getBalance();
// { balance: 50000, currency: 'TZS', ... }
```

---

## Payouts

All payout methods live under `clickpesa.payouts.*`:

```js
// Preview mobile money payout (validate + fee before committing)
const preview = await clickpesa.payouts.previewMNOPayout({
  amount: 1000,
  phoneNumber: '255712345678',
  currency: 'TZS',
  orderReference: 'PAYOUT-001',
});

// Execute mobile money payout
const mno = await clickpesa.payouts.createMNOPayout({
  amount: 1000,
  phoneNumber: '255712345678',
  currency: 'TZS',
  orderReference: 'PAYOUT-001',
});

// Get supported banks list (needed for BIC codes)
const banks = await clickpesa.payouts.getBankList();
// [ { name: 'AMANA BANK LIMITED', bic: 'AMANTZTZ' }, ... ]

// Preview bank payout
const bankPreview = await clickpesa.payouts.previewBankPayout({
  amount: 20000,
  accountNumber: '123456789',
  currency: 'TZS',
  orderReference: 'BP-001',
  bic: 'EQBLTZTZ',
  transferType: 'ACH',
});

// Execute bank payout
const bank = await clickpesa.payouts.createBankPayout({
  amount: 20000,
  accountNumber: '123456789',
  accountName: 'John Doe',
  currency: 'TZS',
  orderReference: 'BP-001',
  bic: 'EQBLTZTZ',
  transferType: 'ACH',
});

// Query a specific payout by order reference
const payoutStatus = await clickpesa.payouts.queryPayoutStatus('PAYOUT-001');

// Query all payouts with filters + pagination
const { data, totalCount } = await clickpesa.payouts.queryAllPayouts({
  channel: 'MOBILE MONEY',
  status: 'SUCCESS',
  startDate: '2025-01-01',
  limit: 50,
});
```

---

## Webhooks

### Express example

```js
const express = require('express');
const { ClickPesaWebhook } = require('clickpesa');

const router = express.Router();

router.post('/webhooks/clickpesa', express.json(), (req, res) => {
  const event = ClickPesaWebhook.parse(req.body);

  console.log('ClickPesa event:', event);
  // {
  //   transactionId: 'TX123456',
  //   reference: 'ORDER-001',
  //   status: 'successful',  // pending | processing | successful | failed | cancelled
  //   amount: 1000,
  //   currency: 'TZS',
  //   paymentMethod: 'ussd',
  //   phone: '255712345678',
  //   raw: { ... }
  // }

  // Update your DB here …

  res.json({ status: 'received' });
});
```

### Signature verification (optional)

If ClickPesa sends an `X-ClickPesa-Signature` header:

```js
router.post('/webhooks/clickpesa', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-clickpesa-signature'];
  const isValid = ClickPesaWebhook.verify(
    req.body.toString(),
    signature,
    process.env.CLICKPESA_CLIENT_SECRET
  );

  if (!isValid) return res.status(401).json({ error: 'Invalid signature' });

  const event = ClickPesaWebhook.parse(JSON.parse(req.body));
  // handle …
  res.json({ status: 'received' });
});
```

---

## Environment variables

```env
CLICKPESA_CLIENT_ID=your-client-id
CLICKPESA_CLIENT_SECRET=your-client-secret
CLICKPESA_BASE_URL=https://api.clickpesa.com/third-parties
```

---

## API endpoints

| Feature              | Method | Endpoint                                     |
| -------------------- | ------ | -------------------------------------------- |
| Token Authentication | POST   | `/generate-token`                            |
| USSD Checkout        | POST   | `/payments/initiate-ussd-push-request`       |
| Card Payment         | POST   | `/payments/initiate-card-payment`            |
| Payment Status       | GET    | `/payments/{orderReference}`                 |
| Wallet Balance       | GET    | `/account/balance`                           |
| Preview MNO Payout   | POST   | `/payouts/preview-mobile-money-payout`       |
| Create MNO Payout    | POST   | `/payouts/create-mobile-money-payout`        |
| Preview Bank Payout  | POST   | `/payouts/preview-bank-payout`               |
| Create Bank Payout   | POST   | `/payouts/create-bank-payout`                |
| Query Payout         | GET    | `/payouts/{orderReference}`                  |
| Query All Payouts    | GET    | `/payouts/all`                               |
| Bank List            | GET    | `/list/banks`                                |

---

## Testing

```bash
node --test tests/clickpesa.test.js tests/payouts.test.js
```

No external test runner required — uses Node.js built-in `node:test`.

---

## License

MIT © [Emil Kitua](https://github.com/emilkitua93)
# clickpesa-nodejs
# clickpesa-nodejs
