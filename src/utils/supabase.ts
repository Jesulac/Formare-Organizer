import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PersistedPayload } from './storage';

// Permanent Supabase credentials provided for Formare 3D
export const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://otcrzcvuwtrlmjyuvdfd.supabase.co';

export const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90Y3J6Y3Z1d3RybG1qeXV2ZGZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NDY4OTYsImV4cCI6MjEwNjUyMjg5Nn0.MSFRgK0bUj84TUeh-6HsJ7egiojlLZd7_njnc0ojpXM';

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (clientInstance) return clientInstance;

  try {
    clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return clientInstance;
  } catch (err) {
    console.error('Error al inicializar cliente de Supabase:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return true;
}

/**
 * Loads the latest central state from Supabase 'app_state' table.
 */
export async function loadFromSupabase(): Promise<PersistedPayload | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('payload')
      .eq('id', 'main')
      .maybeSingle();

    if (error) {
      console.warn('Aviso al leer de Supabase:', error.message);
      return null;
    }

    if (data && data.payload && Array.isArray(data.payload.operations)) {
      return data.payload as PersistedPayload;
    }
  } catch (err) {
    console.error('Error al conectar con Supabase:', err);
  }
  return null;
}

/**
 * Saves the central state directly to Supabase.
 */
export async function saveToSupabase(payload: PersistedPayload): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase.from('app_state').upsert({
      id: 'main',
      payload,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error al guardar en Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Fallo en la llamada a Supabase:', err);
    return false;
  }
}

/**
 * Subscribes to real-time changes in Supabase 'app_state' table so any change
 * made on Sandra's phone or on your PC updates instantly in all open screens.
 */
export function subscribeToSupabaseRealtime(
  onRemotePayload: (payload: PersistedPayload) => void
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  try {
    const channel = supabase
      .channel('app_state_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_state',
          filter: 'id=eq.main',
        },
        (payload: any) => {
          const newRecord = payload.new;
          if (newRecord?.payload && Array.isArray(newRecord.payload.operations)) {
            onRemotePayload(newRecord.payload as PersistedPayload);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  } catch (err) {
    console.error('Error en suscripción en tiempo real de Supabase:', err);
    return () => {};
  }
}
