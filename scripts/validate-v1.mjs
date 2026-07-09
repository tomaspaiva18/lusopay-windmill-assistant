import fs from 'node:fs';
import path from 'node:path';

const expectedWorkflows = [
  'common/error_logger.workflow.json',
  'adapters/lusopay_listar_pagamentos.adapter.json',
  'adapters/lusopay_listar_pagamentos_mock.adapter.json',
  'adapters/loja_listar_pagamentos.interface.json',
  'adapters/loja_obter_cliente.interface.json',
  'tools/listar_pagamentos.workflow.json',
  'tools/obter_pagamento_por_order_id.workflow.json',
  'tools/listar_pagamentos_pendentes.workflow.json',
  'tools/resumo_pagamentos.workflow.json',
  'tools/comparar_pagamentos_loja_lusopay.workflow.json',
  'tools/obter_cliente.workflow.json',
  'tools/resumo_cliente.workflow.json',
  'tools/listar_encomendas_cliente.workflow.json',
  'tools/clientes_mais_ativos.workflow.json',
  'tools/clientes_com_pagamentos_pendentes.workflow.json',
  'tools/pagamentos_falhados.workflow.json',
  'tools/pagamentos_por_metodo.workflow.json',
  'tools/pagamentos_por_valor.workflow.json',
  'tools/relatorio_diario.workflow.json',
  'tools/pagamentos_pagos_lusopay_pendentes_loja.workflow.json',
  'server/lusopay_mcp_server.workflow.json',
];

const forbiddenV1WorkflowText = [
  'criar_link_pagamento',
  'paybylink_api_v3/run',
  'sincronizar_pagamentos',
  'pagamentos_confirmados',
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function relativeSet(root) {
  return new Set(
    walk(root)
      .filter((file) => file.endsWith('.json'))
      .map((file) => path.relative(root, file).replaceAll(path.sep, '/')),
  );
}

function validateWorkflowTree(root, { importSafe }) {
  const files = relativeSet(root);
  for (const expected of expectedWorkflows) {
    assert(files.has(expected), `${root}: workflow esperado em falta: ${expected}`);
  }

  const unexpected = [...files].filter((file) => !expectedWorkflows.includes(file));
  assert(unexpected.length === 0, `${root}: workflows inesperados: ${unexpected.join(', ')}`);

  for (const relative of files) {
    const file = path.join(root, relative);
    const raw = fs.readFileSync(file, 'utf8');
    const workflow = JSON.parse(raw);

    assert(workflow.name, `${relative}: workflow sem name`);
    assert(Array.isArray(workflow.nodes), `${relative}: workflow sem nodes[]`);

    for (const forbidden of forbiddenV1WorkflowText) {
      assert(!raw.includes(forbidden), `${relative}: contém referência fora do scope V1: ${forbidden}`);
    }

    if (importSafe) {
      assert(!('id' in workflow), `${relative}: dist não deve conter workflow.id`);
      assert(!workflow.settings?.errorWorkflow, `${relative}: dist não deve conter settings.errorWorkflow`);
    }

    for (const node of workflow.nodes) {
      assert(node.id && node.name && node.type, `${relative}: nó inválido`);

      if (importSafe) {
        assert(!node.credentials, `${relative}: dist não deve conter credentials no nó ${node.name}`);
      }

      const workflowId = node.parameters?.workflowId;
      if (importSafe && workflowId && typeof workflowId === 'object') {
        assert(workflowId.value === '', `${relative}: workflowId deve estar vazio no nó ${node.name}`);
      }
    }
  }
}

function validateEnv() {
  const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
  const envExample = fs.readFileSync('.env.example', 'utf8');
  assert(envExample.includes('STORE_ADAPTER_TYPE=mock'), '.env.example deve usar STORE_ADAPTER_TYPE=mock');
  if (env) {
    assert(env.includes('STORE_ADAPTER_TYPE=mock'), '.env deve usar STORE_ADAPTER_TYPE=mock para testes V1');
  }
}

function validateExamples() {
  for (const file of [
    'examples/mock_store_orders.json',
    'examples/mock_customers.json',
    'examples/mock_lusopay_payments.json',
    'examples/v1_tool_inputs_outputs.json',
  ]) {
    assert(fs.existsSync(file), `exemplo em falta: ${file}`);
    readJson(file);
  }
}

validateWorkflowTree('workflows', { importSafe: false });
validateWorkflowTree(path.join('dist', 'workflows-import'), { importSafe: true });
validateEnv();
validateExamples();

console.log('V1 validation ok');
