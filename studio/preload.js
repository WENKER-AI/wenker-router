/**
 * WENKER Studio - preload.
 * Phan tach renderer (chromium sandbox) khoi Node. Chi lo ra mot mat na ham
 * dac hieu qua contextBridge; khong bao gio trinh Node API tho cho web page.
 */
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("wenkerIde", {
  status: () => ipcRenderer.invoke("wenker:status"),
  pickFolder: () => ipcRenderer.invoke("wenker:pickFolder"),
  openFolder: (abs) => ipcRenderer.invoke("wenker:openFolder", abs),
  listDir: (rel) => ipcRenderer.invoke("wenker:listDir", rel),
  listFiles: (opts) => ipcRenderer.invoke("wenker:listFiles", opts || {}),
  readFile: (rel) => ipcRenderer.invoke("wenker:readFile", rel),
  writeFile: (rel, content) => ipcRenderer.invoke("wenker:writeFile", { rel, content }),
  deleteFile: (rel) => ipcRenderer.invoke("wenker:deleteFile", rel),
  stat: (rel) => ipcRenderer.invoke("wenker:stat", rel),
  rename: (from, to) => ipcRenderer.invoke("wenker:rename", { from, to }),
  createEntry: (rel, dir) => ipcRenderer.invoke("wenker:createEntry", { rel, dir }),
  reveal: (rel) => ipcRenderer.invoke("wenker:reveal", rel),
  runCommand: (command, args, timeoutMs) => ipcRenderer.invoke("wenker:runCommand", { command, args, timeoutMs }),
  openExternal: (url) => ipcRenderer.invoke("wenker:openExternal", url),
  configSave: (obj) => ipcRenderer.invoke("wenker:configSave", obj),
  git: (args, cwd) => ipcRenderer.invoke("wenker:git", { args, cwd }),
  snapshot: (id, files) => ipcRenderer.invoke("wenker:snapshot", { id, files }),
  restore: (id) => ipcRenderer.invoke("wenker:restore", { id })
});
