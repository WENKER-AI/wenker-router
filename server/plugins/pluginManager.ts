/**
 * Plugin System for WENKER Router
 * Tuần 3 - Backend: Xây dựng Plugin System
 * 
 * Features:
 * - Đăng ký routes tùy chỉnh
 * - Thêm middleware
 * - Hook vào request/response lifecycle
 * - Quản lý plugin config
 */

import { Express, Request, Response, NextFunction, Router, Application } from 'express';
import path from 'path';
import fs from 'fs';

interface PluginConfig {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  enabled: boolean;
}

interface PluginHooks {
  onRequest?: (req: Request, res: Response, next: NextFunction) => void;
  onResponse?: (req: Request, res: Response, next: NextFunction) => void;
  onError?: (err: Error, req: Request, res: Response, next: NextFunction) => void;
}

interface Plugin {
  config: PluginConfig;
  hooks?: PluginHooks;
  routes?: (app: Application) => void;
  middleware?: (req: Request, res: Response, next: NextFunction) => void;
  register?: (app: Application, options?: any) => Promise<void>;
  unregister?: () => Promise<void>;
}

class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  /**
   * Đăng ký một plugin mới
   */
  async registerPlugin(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.config.id)) {
      throw new Error(`Plugin ${plugin.config.id} đã tồn tại`);
    }

    console.log(`[PluginManager] Đăng ký plugin: ${plugin.config.id} v${plugin.config.version}`);

    // Thêm hooks
    if (plugin.hooks) {
      if (plugin.hooks.onRequest) {
        this.app.use(plugin.hooks.onRequest);
      }
      if (plugin.hooks.onResponse) {
        this.app.use(plugin.hooks.onResponse);
      }
      if (plugin.hooks.onError) {
        this.app.use(plugin.hooks.onError);
      }
    }

    // Thêm middleware
    if (plugin.middleware) {
      this.app.use(plugin.middleware);
    }

    // Thêm routes
    if (plugin.routes) {
      plugin.routes(this.app);
    }

    // Gọi hàm register nếu có
    if (plugin.register) {
      await plugin.register(this.app);
    }

    this.plugins.set(plugin.config.id, plugin);
    console.log(`[PluginManager] Plugin ${plugin.config.id} đã được đăng ký`);
  }

  /**
   * Gỡ đăng ký plugin
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} không tồn tại`);
    }

    console.log(`[PluginManager] Gỡ đăng ký plugin: ${pluginId}`);

    // Gọi hàm unregister nếu có
    if (plugin.unregister) {
      await plugin.unregister();
    }

    this.plugins.delete(pluginId);
  }

  /**
   * Lấy danh sách plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Lấy plugin theo ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Load plugins từ thư mục
   */
  async loadPluginsFromDirectory(directory: string): Promise<void> {
    const pluginsDir = path.join(directory, 'plugins');
    
    if (!fs.existsSync(pluginsDir)) {
      console.log(`[PluginManager] Thư mục plugins không tồn tại: ${pluginsDir}`);
      return;
    }

    const pluginFiles = fs.readdirSync(pluginsDir).filter(
      (file) => file.endsWith('.plugin.js') || file.endsWith('.plugin.ts')
    );

    for (const file of pluginFiles) {
      try {
        const pluginPath = path.join(pluginsDir, file);
        const pluginModule = require(pluginPath);
        
        // Nếu module có default export
        const plugin = pluginModule.default || pluginModule;
        
        if (plugin && plugin.config) {
          await this.registerPlugin(plugin);
        } else {
          console.warn(`[PluginManager] Plugin không hợp lệ: ${file}`);
        }
      } catch (error) {
        console.error(`[PluginManager] Lỗi load plugin ${file}:`, error);
      }
    }
  }

  /**
   * Tạo middleware để hook vào request
   */
  createRequestHook(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      // Chạy các hook trước request
      const pluginIds = Array.from(this.plugins.keys());
      const runHooks = async (index: number = 0) => {
        if (index >= pluginIds.length) {
          return next();
        }
        
        const pluginId = pluginIds[index];
        const plugin = this.plugins.get(pluginId);
        
        if (plugin?.hooks?.onRequest) {
          try {
            plugin.hooks.onRequest(req, res, () => runHooks(index + 1));
          } catch (error) {
            console.error(`[PluginManager] Lỗi hook onRequest từ plugin ${pluginId}:`, error);
            runHooks(index + 1);
          }
        } else {
          runHooks(index + 1);
        }
      };
      
      runHooks();
    };
  }

  /**
   * Tạo middleware để hook vào response
   */
  createResponseHook(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      const originalJson = res.json;

      res.send = function (body?: any): Response {
        // Chạy các hook sau response
        const pluginIds = Array.from(this.plugins.keys());
        const runHooks = async (index: number = 0) => {
          if (index >= pluginIds.length) {
            originalSend.call(this, body);
            return this;
          }
          
          const pluginId = pluginIds[index];
          const plugin = this.plugins.get(pluginId);
          
          if (plugin?.hooks?.onResponse) {
            try {
              plugin.hooks.onResponse(req, this, () => runHooks(index + 1));
            } catch (error) {
              console.error(`[PluginManager] Lỗi hook onResponse từ plugin ${pluginId}:`, error);
              runHooks(index + 1);
            }
          } else {
            runHooks(index + 1);
          }
        };
        
        runHooks();
        return this;
      };

      res.json = function (body?: any): Response {
        const pluginIds = Array.from(this.plugins.keys());
        const runHooks = async (index: number = 0) => {
          if (index >= pluginIds.length) {
            originalJson.call(this, body);
            return this;
          }
          
          const pluginId = pluginIds[index];
          const plugin = this.plugins.get(pluginId);
          
          if (plugin?.hooks?.onResponse) {
            try {
              plugin.hooks.onResponse(req, this, () => runHooks(index + 1));
            } catch (error) {
              console.error(`[PluginManager] Lỗi hook onResponse từ plugin ${pluginId}:`, error);
              runHooks(index + 1);
            }
          } else {
            runHooks(index + 1);
          }
        };
        
        runHooks();
        return this;
      };

      next();
    };
  }
}

export { PluginManager, Plugin, PluginConfig, PluginHooks };
