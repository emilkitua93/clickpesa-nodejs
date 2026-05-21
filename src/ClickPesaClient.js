'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Low-level HTTP client for the ClickPesa API.
 * Handles token acquisition, caching, and all HTTP requests.
 */
class ClickPesaClient {
  /**
   * @param {object} config
   * @param {string} config.clientId       - ClickPesa OAuth client ID
   * @param {string} config.clientSecret   - ClickPesa OAuth client secret
   * @param {string} [config.baseUrl]      - API base URL (default: https://api.clickpesa.com/third-parties)
   * @param {number} [config.timeout]      - Request timeout in ms (default: 30000)
   */
  constructor({ clientId, clientSecret, baseUrl = 'https://api.clickpesa.com/third-parties', timeout = 30_000 } = {}) {
    if (!clientId) throw new Error('ClickPesa: clientId is required');
    if (!clientSecret) throw new Error('ClickPesa: clientSecret is required');

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;

    this._token = null;
    this._tokenExpiresAt = null;
  }

  // ─── Token management ────────────────────────────────────────────────────

  _isTokenValid() {
    return this._token && this._tokenExpiresAt && Date.now() < this._tokenExpiresAt;
  }

  async _fetchToken() {
    const data = await this._request('POST', '/generate-token', null, {
      skipAuth: true,
      extraHeaders: {
        'client-id': this.clientId,
        'client-secret': this.clientSecret,
      },
    });

    this._token = data.token ?? data.access_token;
    // Subtract 60 s buffer so we refresh slightly before actual expiry
    const expiresIn = data.expires_in ?? data.expiresIn ?? 3600;
    this._tokenExpiresAt = Date.now() + (expiresIn - 60) * 1000;
    return this._token;
  }

  async _getToken() {
    if (this._isTokenValid()) return this._token;
    return this._fetchToken();
  }

  // ─── Core request helper ─────────────────────────────────────────────────

  /**
   * @param {string} method              - HTTP verb (GET | POST | PUT | DELETE)
   * @param {string} path                - API path, e.g. '/payments/initiate-ussd-push-request'
   * @param {object|null} [body]         - JSON body (for POST/PUT)
   * @param {object} [options]
   * @param {boolean} [options.skipAuth]        - Skip Authorization header (used for token fetch)
   * @param {object}  [options.extraHeaders]    - Additional headers to merge in
   * @returns {Promise<any>}
   */
  async _request(method, path, body = null, { skipAuth = false, extraHeaders = {} } = {}) {
    const url = new URL(this.baseUrl + path);
    const isSecure = url.protocol === 'https:';
    const lib = isSecure ? https : http;

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...extraHeaders,
    };

    if (!skipAuth) {
      const token = await this._getToken();
      headers['Authorization'] = `Bearer ${token}`;
    }

    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (isSecure ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers,
      timeout: this.timeout,
    };

    return new Promise((resolve, reject) => {
      const req = lib.request(reqOptions, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = raw; }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            const err = new Error(`ClickPesa API error [${res.statusCode}]: ${raw}`);
            err.statusCode = res.statusCode;
            err.response = parsed;
            reject(err);
          }
        });
      });

      req.on('timeout', () => { req.destroy(); reject(new Error('ClickPesa: request timed out')); });
      req.on('error', reject);

      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  // ─── Convenience methods ─────────────────────────────────────────────────

  get(path) { return this._request('GET', path); }
  post(path, body) { return this._request('POST', path, body); }
  put(path, body) { return this._request('PUT', path, body); }
  delete(path) { return this._request('DELETE', path); }
}

module.exports = ClickPesaClient;
