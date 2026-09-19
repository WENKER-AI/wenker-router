#!/usr/bin/env node
/**
 * wenker-chat - Simple terminal AI chat client for WENKER Router
 * 
 * Usage:
 *   npx @wenker-ai/wenker-chat
 *   # or globally
 *   wenker-chat
 */

import chalk from 'chalk';
import axios, { AxiosInstance } from 'axios';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import fs from 'fs';
import readline from 'readline/promises';
import { stdin, stdout } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const WENKER_DIR = resolve(PROJECT_ROOT, '..');

// Types
interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

interface Model {
  id: string;
  object: string;
  owned_by: string;
  wenker_provider?: string;
  wenker_provider_name?: string;
  wenker_free?: boolean;
}

interface ModelsResponse {
  data: Model[];
}

interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: Message;
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// WENKER Router Manager
class WenkerRouterManager {
  private process: ChildProcess | null = null;
  private baseUrl = 'http://localhost:3600';
  private apiClient: AxiosInstance;
  private isStarting = false;
  private startPromise: Promise<void> | null = null;

  constructor(baseUrl = 'http://localhost:3600') {
    this.baseUrl = baseUrl;
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async start(): Promise<void> {
    if (this.process && !this.process.killed) {
      return this.verifyHealth();
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.isStarting = true;
    this.startPromise = this.doStart();
    
    try {
      await this.startPromise;
    } finally {
      this.isStarting = false;
      this.startPromise = null;
    }
  }

  private async doStart(): Promise<void> {
    console.log(chalk.cyan('Starting WENKER Router...'));
    
    const wenkerPaths = [
      join(WENKER_DIR, 'server', 'index.js'),
      join(PROJECT_ROOT, 'server', 'index.js'),
    ];

    let wenkerEntry = '';
    for (const p of wenkerPaths) {
      if (fs.existsSync(p)) {
        wenkerEntry = p;
        break;
      }
    }

    if (!wenkerEntry) {
      throw new Error('WENKER Router not found. Install with: npm install -g @wenker-ai/wenker-router');
    }

    console.log(chalk.gray(`   Using: ${wenkerEntry}`));

    this.process = spawn('node', [wenkerEntry], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, WENKER_HOME: join(PROJECT_ROOT, '.wenker') },
    });

    this.process.stdout?.on('data', (data) => {
      const str = data.toString();
      if (str.includes('Core Server Running') || str.includes('Error')) {
        console.log(chalk.gray(`[WENKER] ${str.trim()}`));
      }
    });

    this.process.stderr?.on('data', (data) => {
      const str = data.toString().trim();
      if (str && !str.includes('ProactiveHealthChecker') && !str.includes('fetch failed') && !str.includes('unhealthy')) {
        console.log(chalk.red(`[WENKER] ${str}`));
      }
    });

    this.process.on('exit', (code) => {
      console.log(chalk.yellow(`WENKER Router exited with code ${code}`));
      this.process = null;
    });

    await this.waitForReady();
  }

  private async waitForReady(timeout = 30000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        await this.verifyHealth();
        console.log(chalk.green('✓ WENKER Router ready'));
        return;
      } catch {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    throw new Error('WENKER Router failed to start within timeout');
  }

  async verifyHealth(): Promise<void> {
    await this.apiClient.get('/health');
  }

  async getModels(): Promise<Model[]> {
    const res = await this.apiClient.get<ModelsResponse>('/v1/models');
    return res.data.data;
  }

  async *streamChatCompletion(req: ChatCompletionRequest): AsyncGenerator<string> {
    const res = await this.apiClient.post('/v1/chat/completions', { ...req, stream: true }, {
      responseType: 'stream',
    });

    for await (const chunk of res.data) {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }

  stop(): void {
    if (this.process && !this.process.killed) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }
}

// Global instance
const wenker = new WenkerRouterManager();

// Types
interface Model {
  id: string;
  object: string;
  owned_by: string;
  wenker_provider?: string;
  wenker_provider_name?: string;
  wenker_free?: boolean;
}

interface ModelsResponse {
  data: Model[];
}

interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

// CLI Chat
async function main() {
  console.log(chalk.bold.cyan('\n╔══════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('  wenker') + chalk.bold.green('chat') + chalk.bold.cyan('  ║'));
  console.log(chalk.bold.cyan('║') + chalk.gray('  WENKER Router Terminal AI   ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════╝\n'));

  // Initialize WENKER
  try {
    console.log(chalk.gray('Connecting to WENKER Router...'));
    await wenker.start();
    
    const modelList = await wenker.getModels();
    const freeModels = modelList.filter(m => m.wenker_free);
    const paidModels = modelList.filter(m => !m.wenker_free);
    
    // Default to a free model
    let selectedModel = freeModels.find(m => m.id.includes('deepseek'))?.id 
      || freeModels[0]?.id 
      || modelList[0]?.id 
      || 'wenker-cloud/wenker-deepseek-r1-free';
    
    console.log(chalk.green(`✓ Connected - ${modelList.length} models available`));
    console.log(chalk.gray(`Free: ${freeModels.length} | Paid: ${paidModels.length}`));
    console.log(chalk.cyan(`Model: ${selectedModel}\n`));
    
    console.log(chalk.gray('Commands: /model (switch), /help, /quit\n'));
    
  } catch (err) {
    console.error(chalk.red('Failed to connect:'), err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Conversation history
  const history: Message[] = [
    { role: 'system', content: 'You are a helpful AI assistant. Be concise and practical.' }
  ];

  let selectedModel = 'wenker-cloud/wenker-deepseek-r1-free';

  // Readline interface
  const rl = readline.createInterface({ input: stdin, output: stdout, prompt: chalk.cyan('> ') });
  
  rl.setPrompt(chalk.cyan('> '));
  rl.prompt();

  let isStreaming = false;
  let currentResponse = '';

  for await (const line of rl) {
    const input = line.trim();
    
    if (!input) {
      rl.prompt();
      continue;
    }

    // Commands
    if (input.startsWith('/')) {
      const [cmd, ...args] = input.slice(1).split(' ');
      
      switch (cmd) {
        case 'model':
          if (args.length === 0) {
            // List models
            const models = await wenker.getModels();
            console.log(chalk.cyan('\nAvailable models:'));
            models.forEach(m => {
              const tag = m.wenker_free ? chalk.green('FREE') : chalk.yellow('PAID');
              const marker = m.id === selectedModel ? chalk.cyan('← current') : '';
              console.log(`  ${tag} ${m.id} ${marker}`);
            });
          } else {
            // Switch model
            const newModel = args.join(' ');
            const models = await wenker.getModels();
            if (models.some(m => m.id === newModel)) {
              selectedModel = newModel;
              console.log(chalk.green(`Model switched to: ${selectedModel}`));
            } else {
              console.log(chalk.red(`Model not found: ${newModel}`));
            }
          }
          break;
          
        case 'help':
          console.log(chalk.cyan('\nCommands:'));
          console.log('  /model [name]    - List or switch model');
          console.log('  /clear           - Clear conversation history');
          console.log('  /help            - Show this help');
          console.log('  /quit, /exit     - Exit');
          break;
          
        case 'clear':
          history.length = 1; // Keep system message
          console.log(chalk.green('Conversation cleared'));
          break;
          
        case 'quit':
        case 'exit':
          console.log(chalk.gray('\nGoodbye!'));
          wenker.stop();
          process.exit(0);
          
        default:
          console.log(chalk.red(`Unknown command: ${cmd}. Type /help`));
      }
      rl.prompt();
      continue;
    }

    // Regular message
    const userMessage = input;
    history.push({ role: 'user', content: userMessage });

    // Stream response
    process.stdout.write(chalk.green('assistant: '));
    isStreaming = true;
    currentResponse = '';

    try {
      const req: ChatCompletionRequest = {
        model: selectedModel,
        messages: history,
        stream: true,
        temperature: 0.7,
      };

      for await (const chunk of wenker.streamChatCompletion(req)) {
        currentResponse += chunk;
        process.stdout.write(chunk);
      }
      
      console.log(); // New line after streaming
      
      // Add to history
      history.push({ role: 'assistant', content: currentResponse });
      
    } catch (err) {
      console.log(chalk.red(`\nError: ${err instanceof Error ? err.message : 'Unknown error'}`));
    }

    rl.prompt();
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log(chalk.gray('\nGoodbye!'));
  wenker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  wenker.stop();
  process.exit(0);
});

main().catch(err => {
  console.error(chalk.red('Fatal error:'), err);
  wenker.stop();
  process.exit(1);
});