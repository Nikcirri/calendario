// Salvataggio e lettura di file: backup dell'app e tabelle del recap.
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { db } from '../db';
import { backupFileName, makeBackup, parseBackup, type BackupData } from '../logic/backup';
import { APP_VERSION, isNative } from '../platform';
import { exportAll, importAll } from '../repo';

/**
 * Salva un file di testo e apre "Condividi" (Drive, email, WhatsApp…).
 * Nel browser lo scarica. Restituisce false se si chiude "Condividi" senza scegliere.
 */
export async function shareTextFile(name: string, text: string, mime: string, dialogTitle: string): Promise<boolean> {
  if (!isNative()) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  }
  const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  try {
    await Share.share({ title: name, files: [uri], dialogTitle });
    return true;
  } catch (e) {
    if (/cancel/i.test(String(e instanceof Error ? e.message : e))) return false;
    throw e;
  }
}

/** Crea il backup e apre "Condividi". */
export async function shareBackup(): Promise<boolean> {
  const text = makeBackup(await exportAll(db), APP_VERSION);
  return shareTextFile(backupFileName(), text, 'application/json', 'Salva il backup');
}

export async function readBackupFile(file: File): Promise<BackupData> {
  return parseBackup(await file.text());
}

export async function restoreBackup(data: BackupData): Promise<void> {
  await importAll(db, data);
}
