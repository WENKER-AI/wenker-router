/**
 * Example Plugin for WENKER Router
 * Tuần 3 - Plugin System Demo
 * 
 * Cách sử dụng:
 * 1. Copy file này vào thư mục /plugins
 * 2. Chỉnh sửa config
 * 3. Khởi động server, plugin sẽ tự load
 */

import { Plugin, PluginConfig, PluginHooks } from '../server/plugins/pluginManager';
import { Request, Response, NextFunction, Application } from 'express';

const config: PluginConfig = {
  id: 'wenker-example-plugin',
  name: 'WENKER Example Plugin',
  version: '1.0.0',
  description: 'Ví dụ plugin cho WENKER Router',
  author: 'WENKER Team',
  enabled: true,
};

const hooks: PluginHooks = {
  onRequest: (req: Request, res: Response, next: NextFunction) => {
    // Thêm header tùy chỉnh
    res.setHeader('X-WENKER-Plugin', config.id);
    console.log(`[Example Plugin] Request: ${req.method} ${req.path}`);
    next();
  },

  onResponse: (req: Request, res: Response, next: NextFunction) => {
    console.log(`[Example Plugin] Response sent for: ${req.path}`);
    next();
  },

  onError: (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(`[Example Plugin] Error: ${err.message}`);
    next(err);
  },
};

// Thêm routes tùy chỉnh
const routes = (app: Application) => {
  // Custom endpoint
  app.get('/api/example/plugin', (req: Request, res: Response) => {
    res.json({
      message: 'Hello from Example Plugin!',
      plugin: config.id,
      version: config.version,
      timestamp: new Date().toISOString(),
    });
  });

  // Health check cho plugin
  app.get('/api/example/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      plugin: config.id,
      uptime: process.uptime(),
    });
  });
};

// Middleware tùy chỉnh
const middleware = (req: Request, res: Response, next: NextFunction) => {
  // Thêm custom middleware logic
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[Example Plugin] Request duration: ${duration}ms`);
  });
  
  next();
};

const plugin: Plugin = {
  config,
  hooks,
  routes,
  middleware,
  
  // Hàm register (tùy chọn)
  async register(app: Application) {
    console.log(`[Example Plugin] Registering...`);
    // Thực hiện các setup cần thiết
  },
  
  // Hàm unregister (tùy chọn)
  async unregister() {
    console.log(`[Example Plugin] Unregistering...`);
    // Cleanup
  },
};

export default plugin;
