import { createHash, randomBytes } from 'node:crypto';

// Gera um token MCP de merchant para piloto/onboarding.
// O token em claro é mostrado uma única vez; no servidor deve ficar apenas token_hash.

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const merchantId = readArg('merchant-id', 'DEMO_STORE');
const merchantName = readArg('merchant-name', 'Loja Demo');
const label = readArg('label', 'default');
const permissions = readArg('permissions', 'payments:read')
  .split(',')
  .map((permission) => permission.trim())
  .filter(Boolean);
const expiresAt = readArg('expires-at', '');
const token = readArg('token', process.argv[2]?.startsWith('--') ? undefined : process.argv[2])
  || `lusopay_mcp_test_${randomBytes(32).toString('base64url')}`;

const tokenHash = createHash('sha256').update(token).digest('hex');
const serverRecord = {
  token_hash: tokenHash,
  merchant_id: merchantId,
  merchant_name: merchantName,
  label,
  permissions,
  active: true,
  ...(expiresAt ? { expires_at: expiresAt } : {}),
};

console.log(JSON.stringify({
  token,
  token_hash: tokenHash,
  server_record: serverRecord,
  static_mapping_json: [serverRecord],
}, null, 2));

