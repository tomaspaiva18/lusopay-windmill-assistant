import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.LOCAL_CHAT_PORT || 3000);

const systemPrompt = `
És o assistente LusoPay para donos de lojas.
Responde em português de Portugal, de forma curta, clara e operacional.
Usa ferramentas MCP sempre que a pergunta exigir dados reais de pagamentos, links ou estados.
Nunca inventes pagamentos, links, valores ou estados.
Para criar Pay by Link real, confirma se o utilizador quer mesmo dry_run=false.
Quando devolveres links de pagamento, indica que devem ser enviados ao cliente final.
Quando receberes resultados de ferramentas, responde diretamente ao pedido do utilizador.
NÃ£o expliques que recebeste JSON, nÃ£o escrevas exemplos de cÃ³digo e nÃ£o sugiras Python.
Se a ferramenta devolver muitos registos, resume primeiro os totais e mostra apenas os exemplos mais relevantes.
`.trim();

function requiredEnv() {
  return [
    'WINDMILL_BASE_URL',
    'WINDMILL_WORKSPACE',
    'WINDMILL_TOKEN',
    'LUSOPAY_MCP_AUTH_MODE',
    'LUSOPAY_MCP_ACCESS_TOKEN',
  ];
}

function llmConfig() {
  const baseUrl = process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '';
  const model = process.env.LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey, model };
}

function assertRuntimeConfig() {
  const missing = requiredEnv().filter((name) => !process.env[name]);
  const { baseUrl, apiKey } = llmConfig();
  const isLocalOllama = baseUrl.includes('localhost:11434') || baseUrl.includes('127.0.0.1:11434');
  if (!isLocalOllama && !apiKey) missing.push('OPENAI_API_KEY or LLM_API_KEY');
  if (missing.length) {
    throw new Error(`Configuração em falta: ${missing.join(', ')}`);
  }
}

async function createMcpClient() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['mcp-server/dist/index.js'],
    env: process.env,
    stderr: 'pipe',
    cwd: rootDir,
  });

  const client = new Client({
    name: 'lusopay-local-chat',
    version: '1.0.0',
  });

  await client.connect(transport);
  return client;
}

function toOpenAiTools(mcpTools) {
  return mcpTools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || tool.title || tool.name,
      parameters: tool.inputSchema || { type: 'object', properties: {} },
    },
  }));
}

function toolResultToText(result) {
  if (!result) return '';
  if (Array.isArray(result.content)) {
    return result.content.map((item) => item.text || JSON.stringify(item)).join('\n');
  }
  return JSON.stringify(result);
}

function compactPayment(payment) {
  return {
    order_id: payment.order_id ?? null,
    payment_id: payment.payment_id ?? null,
    payment_status: payment.payment_status ?? payment.estado ?? null,
    link_status: payment.link_status ?? null,
    amount: payment.amount ?? null,
    currency: payment.currency ?? null,
    payment_method: payment.payment_method ?? null,
    created_at: payment.created_at ?? null,
    paid_at: payment.paid_at ?? null,
    expires_at: payment.expires_at ?? null,
    has_payment_link: Boolean(payment.payment_link),
  };
}

function compactToolPayload(toolName, payload) {
  if (!payload || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    return {
      total: payload.length,
      shown: Math.min(payload.length, 8),
      records: payload.slice(0, 8).map((record) => (record && typeof record === 'object' ? compactPayment(record) : record)),
    };
  }

  if (Array.isArray(payload.payments)) {
    return {
      tool: toolName,
      summary: payload.summary,
      total: payload.total ?? payload.payments.length,
      filters: payload.filters,
      results_count: payload.log?.results_count,
      payments_shown: Math.min(payload.payments.length, 8),
      payments: payload.payments.slice(0, 8).map(compactPayment),
      note: 'Responde em portuguÃªs de Portugal. NÃ£o incluas JSON nem cÃ³digo; resume os resultados para o dono da loja.',
    };
  }

  if (payload.payment && typeof payload.payment === 'object') {
    return {
      ...payload,
      payment: compactPayment(payload.payment),
      note: 'Responde em portuguÃªs de Portugal. NÃ£o incluas JSON nem cÃ³digo.',
    };
  }

  if (payload.payment_link || payload.checkout_url) {
    return {
      ...payload,
      note: 'Responde em portuguÃªs de Portugal e destaca o link de pagamento apenas se for seguro/necessÃ¡rio.',
    };
  }

  return payload;
}

function compactToolTextForModel(toolName, text) {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(compactToolPayload(toolName, parsed), null, 2);
  } catch {
    return text.length > 6000 ? `${text.slice(0, 6000)}\n\n[resultado truncado para o modelo]` : text;
  }
}

function removeNullishValues(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== null && item !== undefined)
      .map((item) => removeNullishValues(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nested]) => nested !== null && nested !== undefined)
        .map(([key, nested]) => [key, removeNullishValues(nested)]),
    );
  }

  return value;
}

async function callLlm(messages, tools) {
  const { baseUrl, apiKey, model } = llmConfig();
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Erro do LLM: HTTP ${response.status}${detail ? ` ${detail.slice(0, 500)}` : ''}`);
  }

  const body = await response.json();
  const message = body?.choices?.[0]?.message;
  if (!message) throw new Error('Resposta inválida do LLM');
  return message;
}

function normaliseHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((message) => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
    .slice(-20)
    .map((message) => ({ role: message.role, content: message.content }));
}

async function chat(body) {
  assertRuntimeConfig();
  const userMessage = String(body?.message || '').trim();
  if (!userMessage) throw new Error('Mensagem vazia');

  const mcp = await createMcpClient();
  const toolLog = [];

  try {
    const { tools: mcpTools } = await mcp.listTools();
    const tools = toOpenAiTools(mcpTools);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...normaliseHistory(body?.history),
      { role: 'user', content: userMessage },
    ];

    for (let step = 0; step < 6; step += 1) {
      const assistantMessage = await callLlm(messages, tools);
      messages.push(assistantMessage);

      const toolCalls = assistantMessage.tool_calls || [];
      if (!toolCalls.length) {
        return {
          answer: assistantMessage.content || '',
          toolLog,
        };
      }

      for (const toolCall of toolCalls) {
        const name = toolCall.function?.name;
        const rawArgs = toolCall.function?.arguments || '{}';
        const args = removeNullishValues(JSON.parse(rawArgs));
        const result = await mcp.callTool({ name, arguments: args });
        const text = toolResultToText(result);
        const textForModel = compactToolTextForModel(name, text);
        toolLog.push({ name, arguments: args, isError: Boolean(result?.isError), result: text });
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result?.isError ? `Erro da ferramenta ${name}: ${textForModel}` : textForModel,
        });
      }
    }

    return {
      answer: 'Não consegui concluir a resposta porque foram necessárias demasiadas chamadas a ferramentas.',
      toolLog,
    };
  } finally {
    await mcp.close().catch(() => undefined);
  }
}

async function readJsonRequest(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function serveStatic(response, pathname) {
  const filePath = pathname === '/' ? path.join(publicDir, 'index.html') : path.join(publicDir, pathname);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(publicDir)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  const content = await readFile(resolved);
  const type = resolved.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
  response.writeHead(200, { 'Content-Type': type });
  response.end(content);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    if (request.method === 'POST' && url.pathname === '/api/chat') {
      const body = await readJsonRequest(request);
      const result = await chat(body);
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(result));
      return;
    }

    if (request.method === 'GET') {
      await serveStatic(response, url.pathname);
      return;
    }

    response.writeHead(405);
    response.end('Method Not Allowed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: message }));
  }
});

server.listen(port, () => {
  console.log(`LusoPay local chatbot: http://localhost:${port}`);
});
