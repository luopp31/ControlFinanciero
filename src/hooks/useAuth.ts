import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigurado } from '../lib/supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(supabaseConfigurado);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function iniciarSesion(email: string, password: string) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function registrarse(email: string, password: string) {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }

  async function cerrarSesion() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return {
    configurado: supabaseConfigurado,
    session,
    cargando,
    iniciarSesion,
    registrarse,
    cerrarSesion,
  };
}
