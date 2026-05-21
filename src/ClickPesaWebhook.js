'use strict';

const crypto = require('crypto');

/**
 * ClickPesa webhook utilities.
 *
 * Use ClickPesaWebhook.parse() inside your Express / Fastify / Koa route handler
 * to safely parse and (optionally) verify incoming ClickPesa callbacks.
 *
 * @example Express
 * const express = require('express');
 * const { ClickPesaWebhook } = require('clickpesa');
 *
 * const router = express.Router();
 *
 * router.post('/webhooks/clickpesa', express.json(), (req, res) => {
 *   const event = ClickPesaWebhook.parse(req.body);
 *   console.log('ClickPesa webhook:', event);
 *
 *   // Handle event.status: 'successful' | 'failed' | 'pending' | 'cancelled'
 *   // Update your DB here …
 *
 *   res.json({ status: 'received' });
 * });
 */
class ClickPesaWebhook {
  /**
   * Parse and normalise an incoming ClickPesa webhook payload.
   *
   * @param {object} body - Raw JSON body from the request
   * @returns {{
   *   transactionId: string|null,
   *   reference: string|null,
   *   status: string|null,
   *   amount: number|null,
   *   currency: string|null,
   *   paymentMethod: string|null,
   *   phone: string|null,
   *   raw: object
   * }}
   */
  static parse(body = {}) {
    return {
      transactionId: body.transaction_id ?? body.transactionId ?? null,
      reference: body.reference ?? body.reference_id ?? null,
      status: body.status ?? null,
      amount: body.amount != null ? Number(body.amount) : null,
      currency: body.currency ?? null,
      paymentMethod: body.payment_method ?? body.paymentMethod ?? null,
      phone: body.phone ?? body.phone_number ?? null,
      raw: body,
    };
  }

  /**
   * Verify a webhook signature from ClickPesa (HMAC-SHA256).
   * Only use this if ClickPesa provides a signature header.
   *
   * @param {string} rawBody        - Raw request body string (before JSON.parse)
   * @param {string} signature      - Value of the X-ClickPesa-Signature header
   * @param {string} secret         - Your webhook secret / client secret
   * @returns {boolean}
   */
  static verify(rawBody, signature, secret) {
    if (!rawBody || !signature || !secret) return false;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}

module.exports = ClickPesaWebhook;
