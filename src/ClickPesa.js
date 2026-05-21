'use strict';

const ClickPesaClient = require('./ClickPesaClient');
const ClickPesaPayout = require('./ClickPesaPayout');

/**
 * ClickPesa Node.js SDK
 *
 * Mirrors the Laravel package at https://github.com/emilkitua93/clickpesa
 *
 * Supported operations:
 *   - Token authentication (handled automatically / transparently)
 *   - USSD checkout initiation
 *   - Card payment initiation
 *   - Payment status query
 *   - Wallet balance retrieval
 *   - Payouts: mobile money (MNO) and bank disbursements
 */
class ClickPesa {
  /**
   * @param {object} config
   * @param {string} config.clientId       - ClickPesa OAuth client ID
   * @param {string} config.clientSecret   - ClickPesa OAuth client secret
   * @param {string} [config.baseUrl]      - API base URL (default: https://api.clickpesa.com/third-parties)
   * @param {number} [config.timeout]      - HTTP timeout in ms (default: 30 000)
   */
  constructor(config) {
    this.client = new ClickPesaClient(config);

    /**
     * Payout / disbursement methods.
     * @type {ClickPesaPayout}
     */
    this.payouts = new ClickPesaPayout(this.client);
  }

  // ─── USSD Checkout ───────────────────────────────────────────────────────

  /**
   * Initiate a USSD (mobile money) checkout.
   *
   * @param {object} params
   * @param {string} params.phoneNumber     - Phone number in E.164 format without '+', e.g. '255712345678'
   * @param {number} params.amount          - Amount to charge
   * @param {string} params.orderReference  - Unique reference/order ID from your system
   * @param {string} params.checksum        - HMAC checksum / your secret key
   * @returns {Promise<object>}             - ClickPesa API response
   *
   * @example
   * const result = await clickpesa.initiateUSSD({
   *   phoneNumber: '255712345678',
   *   amount: 1000,
   *   orderReference: 'ORDER-001',
   *   checksum: process.env.CLICKPESA_CLIENT_SECRET,
   * });
   */
  async initiateUSSD({ phoneNumber, amount, orderReference, checksum } = {}) {
    if (!phoneNumber) throw new Error('initiateUSSD: phoneNumber is required');
    if (!amount) throw new Error('initiateUSSD: amount is required');
    if (!orderReference) throw new Error('initiateUSSD: orderReference is required');
    if (!checksum) throw new Error('initiateUSSD: checksum is required');

    return this.client.post('/payments/initiate-ussd-push-request', {
      phoneNumber,
      amount,
      orderReference,
      checksum,
    });
  }

  // ─── Card Payment ────────────────────────────────────────────────────────

  /**
   * Initiate a card payment checkout.
   *
   * @param {object} params
   * @param {number} params.amount          - Amount to charge
   * @param {string} [params.currency]      - Currency code (default: 'TZS')
   * @param {string} params.orderReference  - Unique reference/order ID from your system
   * @param {object} [params.customer]      - Customer details, e.g. { id: 'CUST-001' }
   * @param {string} params.checksum        - HMAC checksum / your secret key
   * @returns {Promise<object>}
   *
   * @example
   * const result = await clickpesa.initiateCardPayment({
   *   amount: 5000,
   *   currency: 'TZS',
   *   orderReference: 'ORDER-002',
   *   customer: { id: 'CUST-001' },
   *   checksum: process.env.CLICKPESA_CLIENT_SECRET,
   * });
   */
  async initiateCardPayment({ amount, currency = 'TZS', orderReference, customer, checksum } = {}) {
    if (!amount) throw new Error('initiateCardPayment: amount is required');
    if (!orderReference) throw new Error('initiateCardPayment: orderReference is required');
    if (!checksum) throw new Error('initiateCardPayment: checksum is required');

    return this.client.post('/payments/initiate-card-payment', {
      amount,
      currency,
      orderReference,
      ...(customer && { customer }),
      checksum,
    });
  }

  // ─── Payment Status ───────────────────────────────────────────────────────

  /**
   * Query the status of a payment by order reference.
   *
   * @param {string} orderReference  - The order reference used when creating the payment
   * @returns {Promise<object>}
   *
   * @example
   * const status = await clickpesa.queryStatus('ORDER-001');
   */
  async queryStatus(orderReference) {
    if (!orderReference) throw new Error('queryStatus: orderReference is required');
    return this.client.get(`/payments/${encodeURIComponent(orderReference)}`);
  }

  // ─── Wallet Balance ───────────────────────────────────────────────────────

  /**
   * Retrieve your ClickPesa account balance.
   *
   * @returns {Promise<object>}
   *
   * @example
   * const balance = await clickpesa.getBalance();
   */
  async getBalance() {
    return this.client.get('/account/balance');
  }
}

module.exports = ClickPesa;
