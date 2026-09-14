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
  readFile: (rel) => ipcRenderer.invoke("wenker:readFile", rel),
  writeFile: (rel, content) => ipcRenderer.invoke("wenker:writeFile", { rel, content }),
  deleteFile: (rel) => ipcRenderer.invoke("wenker:deleteFile", rel),
  runCommand: (command, args, timeoutMs) => ipcRenderer.invoke("wenker:runCommand", { command, args, timeoutMs }),
  openExternal: (url) => ipcRenderer.invoke("wenker:openExternal", url)
});
