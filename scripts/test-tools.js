/**
 * test-tools.js - chung minh WENKER Router forward tool-calling nguyen ven.
 *
 * Cach hoat dong:
 *   1) Mo một mock upstream OpenAI-compatible tai 127.0.0.1:8123. No KIEN TRI
 *      payload nhan duoc: neu thieu `tools` hoac mat `tool_calls`/`tool_call_id`
 *      trong history thi bao that (exit 1).
 *   2) Khoi dong router (node server/index.js, PORT=8199) va them custom provider
 *      tro toi mock.
 *   3) Goi /v1/chat/completions 2 nuoc: nuoc 1 expecting tool_calls, nuoc 2 gui
 *      ket qua tool ve expecting cau tra loi tong hop.
 *   4) Test chan doan trung thuc: model mang Pollinations + tools -> phai tra 400
 *      tools_not_supported (khong duoc gia nan hoac im lang boc bo tools).
 *
 * Chay:  node scripts/test-tools.js
 */


const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const MOCK_PORT = 8123;
const ROUTER_PORT = 8199;
const BASE = `http://127.0.0.1:${ROUTER_PORT}`;
const PROVIDER_ID = 'mock-tools-provider';

const seen = { toolsPerCall: [], messagesInSecondCall: null };
const mockFailures = [];

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Doc mot file trong workspace',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
  },
];

function startMock() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => raw += c);
      req.on('end', () => {
        let body = {};
        try {
          body = JSON.parse(raw);
        } catch (e) {
          /* keep empty */
        }
        res.setHeader('Content-Type', 'application/json');

        if (req.url.endsWith('/chat/completions')) {
          const msgs = body.messages || [];
          const last = msgs[msgs.length - 1] || {};

          // Ghi nhan tung luot: luot nay upstream co thay `tools` khong?
          seen.toolsPerCall.push(
            Array.isArray(body.tools) ? body.tools.map((t) => t.function && t.function.name) : null,
          );

          if (last.role === 'tool') {
            // Nuoc 2: history phai du (assistant.tool_calls + tool.tool_call_id).
            const assistantWithCalls = msgs.find(
              (m) => m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length,
            );
            const toolReply = msgs.find((m) => m.role === 'tool' && m.tool_call_id);
            if (!assistantWithCalls)
              mockFailures.push('nuoc 2 thieu assistant.tool_calls trong history');
            if (!toolReply) mockFailures.push('nuoc 2 thieu tool.tool_call_id trong history');
            seen.messagesInSecondCall = {
              assistantToolCalls: Boolean(assistantWithCalls),
              toolCallId: toolReply && toolReply.tool_call_id,
              toolContent: toolReply && toolReply.content,
            };
            return res.end(
              JSON.stringify({
                id: 'mock-2',
                object: 'chat.completion',
                created: 1,
                model: body.model,
                choices: [
                  {
                    index: 0,
                    message: {
                      role: 'assistant',
                      content: 'TOOL_RESULT_OK: ' + (toolReply ? toolReply.content : '?'),
                    },
                    finish_reason: 'stop',
                  },
                ],
                usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
              }),
            );
          }

          // Nuoc 1: tra ve mot tool_calls that.
          return res.end(
            JSON.stringify({
              id: 'mock-1',
              object: 'chat.completion',
              created: 1,
              model: body.model,
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_abc123',
                        type: 'function',
                        function: {
                          name: 'read_file',
                          arguments: JSON.stringify({ path: 'a.txt' }),
                        },
                      },
                    ],
                  },
                  finish_reason: 'tool_calls',
                },
              ],
              usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
            }),
          );
        }

        if (req.url.endsWith('/models')) {
          return res.end(
            JSON.stringify({
              object: 'list',
              data: [{ id: 'mock-model', object: 'model', owned_by: 'mock' }],
            }),
          );
        }
        res.statusCode = 404;
        res.end(JSON.stringify({ error: { message: 'mock: khong ho tro ' + req.url } }));
      });
    });
    server.listen(MOCK_PORT, '127.0.0.1', () => resolve(server));
  });
}

function startRouter() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'index.js')], {
      env: {
        ...process.env,
        PORT: String(ROUTER_PORT),
        HOST: '127.0.0.1',
        WENKER_HOME: path.join(process.env.TEMP || '/tmp', 'wenker-tools-test'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', () => {});
    child.stderr.on('data', (d) => process.stderr.write('[router] ' + d));
    const t0 = Date.now();
    (async function wait() {
      try {
        const r = await fetch(`${BASE}/health`);
        if (r.ok) return resolve(child);
      } catch (e) {
        /* not up yet */
      }
      if (Date.now() - t0 > 20000) return reject(new Error('router khong len duoc trong 20s'));
      setTimeout(wait, 250);
    })();
  });
}

async function api(pathname, options = {}) {
  const r = await fetch(BASE + pathname, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${extra ? '  <- ' + JSON.stringify(extra) : ''}`);
  }
}

(async () => {
  console.log('== test-tools: router phai forward tool-calling nguyen ven ==\n');
  const mock = await startMock();
  const router = await startRouter();
  try {
    // Them custom provider tro ve mock (admin API mo cho loopback).
    const add = await api('/api/providers/custom/add', {
      method: 'POST',
      body: JSON.stringify({
        id: PROVIDER_ID,
        name: 'Mock Tools',
        baseUrl: `http://127.0.0.1:${MOCK_PORT}/v1`,
        authType: 'none',
        requiresAuth: false,
        isFree: true,
        models: [{ id: 'mock-model', name: 'Mock Model', contextWindow: 32000, isFree: true }],
      }),
    });
    check(
      'them custom provider',
      add.status === 200 && add.body && add.body.success,
      add.body && add.body.error,
    );

    // Nuoc 1: gui tools -> phai nhan ve tool_calls.
    const c1 = await api('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'doc a.txt' }],
        tools: TOOLS,
      }),
    });
    const m1 = c1.body && c1.body.choices && c1.body.choices[0].message;
    check('nuoc 1: HTTP 200', c1.status === 200, c1.body && c1.body.error);
    check(
      'nuoc 1: router tra duoc tool_calls',
      Boolean(m1 && Array.isArray(m1.tool_calls) && m1.tool_calls.length === 1),
      m1,
    );
    check(
      'nuoc 1: finish_reason = tool_calls',
      c1.body && c1.body.choices[0].finish_reason === 'tool_calls',
    );
    check(
      'nuoc 1: upstream THAY duoc schema `tools`',
      seen.toolsPerCall[0] && seen.toolsPerCall[0].includes('read_file'),
      seen.toolsPerCall[0],
    );

    // Nuoc 2: gui ket qua tool -> history phai ven nguyen.
    const c2 = await api('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'mock-model',
        messages: [
          { role: 'user', content: 'doc a.txt' },
          m1,
          { role: 'tool', tool_call_id: 'call_abc123', content: 'noi dung file a.txt' },
        ],
        tools: TOOLS,
      }),
    });
    const finalContent = c2.body && c2.body.choices && c2.body.choices[0].message.content;
    check('nuoc 2: HTTP 200', c2.status === 200, c2.body && c2.body.error);
    check(
      'nuoc 2: upstream thay assistant.tool_calls + tool.tool_call_id',
      seen.messagesInSecondCall &&
        seen.messagesInSecondCall.assistantToolCalls &&
        seen.messagesInSecondCall.toolCallId === 'call_abc123',
      seen.messagesInSecondCall,
    );
    check(
      'nuoc 2: cau tra loi cuoi chua ket qua tool',
      typeof finalContent === 'string' && finalContent.includes('noi dung file a.txt'),
      finalContent,
    );

    // Chan doan trung thuc: model Pollinations + tools -> 400 tools_not_supported.
    const c3 = await api('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'wenker-deepseek-r1-free',
        messages: [{ role: 'user', content: 'hi' }],
        tools: TOOLS,
      }),
    });
    check('free no-key model + tools -> 400', c3.status === 400, {
      status: c3.status,
      err: c3.body && c3.body.error && c3.body.error.code,
    });
    check(
      'ma loi = tools_not_supported',
      c3.body && c3.body.error && c3.body.error.code === 'tools_not_supported',
    );

    check(
      'nuoc 2: upstream van thay `tools` (khong bi boc khi gui lai)',
      seen.toolsPerCall[1] && seen.toolsPerCall[1].includes('read_file'),
      seen.toolsPerCall[1],
    );

    // Khong co tools -> hanh vi cu van chay (khong bi loi vi patch).
    const c4 = await api('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'khong dung tool' }],
      }),
    });
    check(
      'khong gui tools -> van 200 (khong ban 400 oan)',
      c4.status === 200,
      c4.body && c4.body.error,
    );
    check(
      'luot khong gui tools: upstream cung khong thay tools (khong chen ngoai)',
      seen.toolsPerCall[2] === null,
      seen.toolsPerCall[2],
    );

    check('mock khong phat hien vi pham', mockFailures.length === 0, mockFailures);
  } finally {
    await api(`/api/providers/custom/${PROVIDER_ID}`, { method: 'DELETE' }).catch(() => {});
    router.kill();
    mock.close();
  }

  console.log(`\n== ${failures === 0 ? 'TAT CA PASS' : failures + ' FAIL'} ==`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('CRASH:', e);
  process.exit(2);
});
