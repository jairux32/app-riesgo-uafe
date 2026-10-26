import { useCallback, useEffect, useState } from 'react';
import {
  isClientsDBReady,
  importClientsFromJSON,
  getClientsCount,
  clearClientsDB
} from '../utils/clientsDB';

/**
 * Base de clientes local (IndexedDB).
 *
 * No descarga datos por red: el archivo con datos personales ya no se publica.
 * La carga se hace manualmente desde un archivo JSON local con `importFromFile`.
 */
export const useClientsDB = () => {
  const [status, setStatus] = useState('idle');
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const ready = await isClientsDBReady();
        const total = ready ? await getClientsCount() : 0;
        if (cancelled) return;
        setCount(total);
        setStatus(total > 0 ? 'ready' : 'empty');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const importFromFile = useCallback(async (file) => {
    if (!file) throw new Error('No se seleccionó ningún archivo');
    setStatus('loading');
    try {
      const jsonData = JSON.parse(await file.text());
      if (!Array.isArray(jsonData?.data)) {
        throw new Error('Formato inválido: se esperaba { data: [...] }');
      }
      const imported = await importClientsFromJSON(jsonData);
      setCount(imported);
      setStatus('ready');
      return imported;
    } catch (err) {
      setStatus('error');
      throw err;
    }
  }, []);

  const clear = useCallback(async () => {
    await clearClientsDB();
    setCount(0);
    setStatus('empty');
  }, []);

  return { status, count, importFromFile, clear };
};
