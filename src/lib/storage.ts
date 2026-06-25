import { mkdir, readFile, readdir, rename, stat, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";

function storageRoot() {
  return path.resolve(process.env.DOCUMENT_STORAGE_ROOT || "./storage");
}

export function storagePath(...parts: string[]) {
  return path.join(storageRoot(), ...parts);
}

export async function ensureDirectory(directory: string) {
  await mkdir(directory, { recursive: true });
}

export async function writeStoredFile(relativeParts: string[], filename: string, content: Buffer | string) {
  const directory = storagePath(...relativeParts);
  await ensureDirectory(directory);
  const filePath = path.join(directory, filename);
  await writeFile(filePath, content);
  return filePath;
}

export function configuredFolder(envName: string) {
  const defaults: Record<string, string[]> = {
    ADUANETXML_OUTBOX: ["aduanetxml", "BandejaSalidaPrevioFirma"],
    ADUANETXML_PRE_SIGN_OUTBOX: ["aduanetxml", "BandejaSalidaPrevioFirma"],
    ADUANETXML_SEND_OUTBOX: ["aduanetxml", "BandejaSalida"],
    ADUANETXML_SENT: ["aduanetxml", "Enviados"],
    ADUANETXML_REJECTED: ["aduanetxml", "Rechazados"],
    ADUANETXML_INBOX: ["aduanetxml", "BandejaEntrada"],
    ADUANETXML_PROCESSED: ["aduanetxml", "processed"],
    ADUANETXML_ERRORS: ["aduanetxml", "errors"],
    ADUANETXML_LOGS: ["aduanetxml", "Logs"],
  };
  return path.resolve(process.env[envName] || storagePath(...(defaults[envName] || ["aduanetxml", envName.toLowerCase().replace("aduanetxml_", "")])));
}

export async function copyToConfiguredFolder(sourcePath: string, envName: string) {
  const folder = configuredFolder(envName);
  await ensureDirectory(folder);
  const targetPath = path.join(folder, path.basename(sourcePath));
  await copyFile(sourcePath, targetPath);
  return targetPath;
}

export async function listConfiguredFolder(envName: string) {
  const folder = configuredFolder(envName);
  await ensureDirectory(folder);
  const files = await readdir(folder);
  const entries = await Promise.all(files.map(async (file) => {
    const filePath = path.join(folder, file);
    const info = await stat(filePath);
    return { file, filePath, isFile: info.isFile(), size: info.size, modifiedAt: info.mtime };
  }));
  return entries.filter((entry) => entry.isFile);
}

export async function moveToConfiguredFolder(sourcePath: string, envName: string) {
  const folder = configuredFolder(envName);
  await ensureDirectory(folder);
  const targetPath = path.join(folder, path.basename(sourcePath));
  await rename(sourcePath, targetPath);
  return targetPath;
}

export async function readStoredText(filePath: string) {
  return readFile(filePath, "utf8");
}

export async function readStoredBuffer(filePath: string) {
  return readFile(filePath);
}
