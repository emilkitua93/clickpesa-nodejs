'use strict';

/**
 * ClickPesa Payouts (Disbursement) API
 *
 * Covers all 7 endpoints from the official docs:
 *   POST /payouts/preview-mobile-money-payout
 *   POST /payouts/create-mobile-money-payout
 *   POST /payouts/preview-bank-payout
 *   POST /payouts/create-bank-payout
 *   GET  /payouts/{orderReference}
 *   GET  /payouts/all
 *   GET  /list/banks
 *
 * Usage:
 *   const { ClickPesa } = require('clickpesa');
 *   const cp = new ClickPesa({ clientId, clientSecret });
 *   const preview = await cp.payouts.previewMNOPayout({ ... });
 */
class ClickPesaPayout {
  /**
   * @param {import('./ClickPesaClient')} client
   */
  constructor(client) {
    this.client = client;
  }

  // ─── Mobile Money (MNO) Payouts ──────────────────────────────────────────

  /**
   * Preview a mobile money payout.
   * Validates phone number, amount, order reference, and returns fee details
   * before you commit the real disbursement.
   *
   * @param {object} params
   * @param {number}  params.amount          - Payout amount
   * @param {string}  params.phoneNumber     - Recipient phone in E.164 format without '+', e.g. '255712345678'
   * @param {string}  params.currency        - Account currency to pay out from ('TZS' | 'USD')
   * @param {string}  params.orderReference  - Your unique order/reference ID
   * @param {string}  [params.checksum]      - HMAC checksum (if enabled on your account)
   * @returns {Promise<{
   *   amount: number, balance: number, channelProvider: string,
   *   fee: number, exchanged: boolean, exchange?: object,
   *   order: object, payoutFeeBearer: string, receiver: object
   * }>}
   *
   * @example
   * const preview = await clickpesa.payouts.previewMNOPayout({
   *   amount: 1000,
   *   phoneNumber: '255712345678',
   *   currency: 'TZS',
   *   orderReference: 'PAYOUT-001',
   * });
   * console.log(`Fee: ${preview.fee}, Provider: ${preview.channelProvider}`);
   */
  async previewMNOPayout({ amount, phoneNumber, currency = 'TZS', orderReference, checksum } = {}) {
    _require({ amount, phoneNumber, orderReference });
    return this.client.post('/third-parties/payouts/preview-mobile-money-payout', {
      amount,
      phoneNumber,
      currency,
      orderReference,
      ...(checksum && { checksum }),
    });
  }

  /**
   * Create (execute) a mobile money payout.
   * Transfers the specified amount to the recipient's mobile wallet.
   *
   * @param {object} params
   * @param {number}  params.amount          - Payout amount
   * @param {string}  params.phoneNumber     - Recipient phone in E.164 format without '+', e.g. '255712345678'
   * @param {string}  params.currency        - Account currency to pay out from ('TZS' | 'USD')
   * @param {string}  params.orderReference  - Your unique order/reference ID
   * @param {string}  [params.checksum]      - HMAC checksum (if enabled on your account)
   * @returns {Promise<{
   *   id: string, orderReference: string, amount: string, currency: string,
   *   fee: string, status: 'AUTHORIZED'|'SUCCESS'|'REVERSED',
   *   channel: 'MOBILE MONEY', channelProvider: string,
   *   beneficiary: object, exchange?: object, exchanged: boolean,
   *   createdAt: string, updatedAt: string, clientId: string
   * }>}
   *
   * @example
   * const payout = await clickpesa.payouts.createMNOPayout({
   *   amount: 1000,
   *   phoneNumber: '255712345678',
   *   currency: 'TZS',
   *   orderReference: 'PAYOUT-001',
   * });
   * console.log(`Payout ID: ${payout.id}, Status: ${payout.status}`);
   */
  async createMNOPayout({ amount, phoneNumber, currency = 'TZS', orderReference, checksum } = {}) {
    _require({ amount, phoneNumber, orderReference });
    return this.client.post('/third-parties/payouts/create-mobile-money-payout', {
      amount,
      phoneNumber,
      currency,
      orderReference,
      ...(checksum && { checksum }),
    });
  }

  // ─── Bank Payouts ─────────────────────────────────────────────────────────

  /**
   * Preview a bank payout.
   * Validates account details, checks channel availability, and returns fee info.
   *
   * @param {object} params
   * @param {number}  params.amount           - Payout amount
   * @param {string}  params.accountNumber    - Beneficiary bank account number
   * @param {string}  params.currency         - Account currency to pay out from ('TZS' | 'USD')
   * @param {string}  params.orderReference   - Your unique order/reference ID
   * @param {string}  params.bic              - Beneficiary bank BIC (use getBankList() to look up)
   * @param {string}  params.transferType     - Settlement type: 'ACH' | 'RTGS'
   * @param {string}  [params.accountCurrency] - Receiving currency (default: 'TZS')
   * @param {string}  [params.checksum]       - HMAC checksum (if enabled on your account)
   * @returns {Promise<object>}
   *
   * @example
   * const banks = await clickpesa.payouts.getBankList();
   * const equityBic = banks.find(b => b.name.includes('Equity')).bic;
   *
   * const preview = await clickpesa.payouts.previewBankPayout({
   *   amount: 20000,
   *   accountNumber: '123456789',
   *   currency: 'TZS',
   *   orderReference: 'BANK-PAYOUT-001',
   *   bic: equityBic,
   *   transferType: 'ACH',
   * });
   */
  async previewBankPayout({
    amount, accountNumber, currency = 'TZS', orderReference,
    bic, transferType = 'ACH', accountCurrency = 'TZS', checksum,
  } = {}) {
    _require({ amount, accountNumber, orderReference, bic, transferType });
    return this.client.post('/third-parties/payouts/preview-bank-payout', {
      amount,
      accountNumber,
      currency,
      orderReference,
      bic,
      transferType,
      accountCurrency,
      ...(checksum && { checksum }),
    });
  }

  /**
   * Create (execute) a bank payout.
   * Transfers the specified amount to the beneficiary's bank account.
   *
   * @param {object} params
   * @param {number}  params.amount           - Payout amount
   * @param {string}  params.accountNumber    - Beneficiary bank account number
   * @param {string}  params.accountName      - Beneficiary account holder name
   * @param {string}  params.currency         - Account currency to pay out from ('TZS' | 'USD')
   * @param {string}  params.orderReference   - Your unique order/reference ID
   * @param {string}  params.bic              - Beneficiary bank BIC (use getBankList() to look up)
   * @param {string}  params.transferType     - Settlement type: 'ACH' | 'RTGS'
   * @param {string}  [params.accountCurrency] - Receiving currency (default: 'TZS')
   * @param {string}  [params.checksum]       - HMAC checksum (if enabled on your account)
   * @returns {Promise<{
   *   id: string, orderReference: string, amount: string, currency: string,
   *   fee: string, status: string, channel: 'BANK TRANSFER',
   *   channelProvider: string, transferType: string,
   *   beneficiary: object, exchange?: object, exchanged: boolean,
   *   createdAt: string, updatedAt: string, clientId: string
   * }>}
   *
   * @example
   * const payout = await clickpesa.payouts.createBankPayout({
   *   amount: 20000,
   *   accountNumber: '123456789',
   *   accountName: 'John Doe',
   *   currency: 'TZS',
   *   orderReference: 'BANK-PAYOUT-001',
   *   bic: 'EQBLTZTZ',
   *   transferType: 'ACH',
   * });
   */
  async createBankPayout({
    amount, accountNumber, accountName, currency = 'TZS', orderReference,
    bic, transferType = 'ACH', accountCurrency = 'TZS', checksum,
  } = {}) {
    _require({ amount, accountNumber, accountName, orderReference, bic, transferType });
    return this.client.post('/third-parties/payouts/create-bank-payout', {
      amount,
      accountNumber,
      accountName,
      currency,
      orderReference,
      bic,
      transferType,
      accountCurrency,
      ...(checksum && { checksum }),
    });
  }

  // ─── Query ────────────────────────────────────────────────────────────────

  /**
   * Query the status of a specific payout by order reference.
   * Returns an array of matching payout records.
   *
   * @param {string} orderReference - Your unique order reference used when creating the payout
   * @returns {Promise<Array<{
   *   id: string, orderReference: string, amount: string, currency: string,
   *   fee: string, status: string, channel: string, channelProvider: string,
   *   transferType?: string, notes?: string, beneficiary: object,
   *   createdAt: string, updatedAt: string, clientId: string
   * }>>}
   *
   * @example
   * const results = await clickpesa.payouts.queryPayoutStatus('PAYOUT-001');
   * console.log(results[0].status); // 'SUCCESS' | 'PROCESSING' | 'PENDING' | 'FAILED' | ...
   */
  async queryPayoutStatus(orderReference) {
    if (!orderReference) throw new Error('queryPayoutStatus: orderReference is required');
    return this.client.get(`/third-parties/payouts/${encodeURIComponent(orderReference)}`);
  }

  /**
   * Query all payouts with optional filtering, sorting, and pagination.
   *
   * @param {object} [params]
   * @param {string}  [params.startDate]      - Filter start date (YYYY-MM-DD or DD-MM-YYYY)
   * @param {string}  [params.endDate]        - Filter end date (YYYY-MM-DD or DD-MM-YYYY)
   * @param {string}  [params.channel]        - 'BANK TRANSFER' | 'MOBILE MONEY'
   * @param {string}  [params.currency]       - e.g. 'TZS' | 'USD'
   * @param {string}  [params.orderReference] - Filter by a specific order reference
   * @param {string}  [params.status]         - 'SUCCESS' | 'PROCESSING' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'REVERSED'
   * @param {string}  [params.transferType]   - 'ACH' | 'RTGS'
   * @param {string}  [params.clientId]       - Filter by application client ID
   * @param {string}  [params.sortBy]         - Field to sort by (default: 'createdAt')
   * @param {string}  [params.orderBy]        - 'ASC' | 'DESC' (default: 'DESC')
   * @param {number}  [params.skip]           - Records to skip for pagination (default: 0)
   * @param {number}  [params.limit]          - Max records to return (default: 20)
   * @returns {Promise<{ data: object[], totalCount: number }>}
   *
   * @example
   * const { data, totalCount } = await clickpesa.payouts.queryAllPayouts({
   *   channel: 'MOBILE MONEY',
   *   status: 'SUCCESS',
   *   startDate: '2025-01-01',
   *   endDate: '2025-12-31',
   *   limit: 50,
   * });
   */
  async queryAllPayouts({
    startDate, endDate, channel, currency, orderReference,
    status, transferType, clientId, sortBy, orderBy = 'DESC',
    skip = 0, limit = 20,
  } = {}) {
    const qs = _buildQueryString({
      startDate, endDate, channel, currency, orderReference,
      status, transferType, clientId, sortBy, orderBy, skip, limit,
    });
    return this.client.get(`/third-parties/payouts/all${qs}`);
  }

  // ─── Bank list ────────────────────────────────────────────────────────────

  /**
   * Retrieve the list of supported banks and their BICs.
   * Use the `bic` value when creating or previewing a bank payout.
   *
   * @returns {Promise<Array<{ name: string, bic: string }>>}
   *
   * @example
   * const banks = await clickpesa.payouts.getBankList();
   * // [ { name: 'AMANA BANK LIMITED', bic: 'AMANTZTZ' }, ... ]
   */
  async getBankList() {
    return this.client.get('/third-parties/list/banks');
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _require(fields) {
  for (const [key, val] of Object.entries(fields)) {
    if (val === undefined || val === null || val === '') {
      throw new Error(`ClickPesa Payouts: ${key} is required`);
    }
  }
}

function _buildQueryString(params) {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return pairs.length ? '?' + pairs.join('&') : '';
}

module.exports = ClickPesaPayout;
