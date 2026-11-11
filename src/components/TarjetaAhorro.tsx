const kick: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, color: 'var(--muted-fg)', display: 'flex', alignItems: 'center', gap: 6 };
const cap: React.CSSProperties = { fontSize: 12.5, color: 'var(--muted-fg)' };

/** "Avaricia sana": qué parte de lo que entró este mes no se gastó. Si no hubo ingresos, no se inventa un porcentaje. */
export function TarjetaAhorro({ ingresos, gastos, oculto }: { ingresos: number; gastos: number; oculto: boolean }) {
  const hayBase = ingresos > 0;
  const pct = hayBase ? Math.round(((ingresos - gastos) / ingresos) * 100) : null;
  const negativo = pct !== null && pct < 0;
  return (
    <div className="mini">
      <div style={kick}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle at 32% 28%, #FFE9A0, #F9C846 60%, #B98A1E)', display: 'inline-block' }} />
        Avaricia sana
      </div>
      <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', marginTop: 4, color: negativo ? 'var(--destructive)' : undefined }}>
        {pct === null || oculto ? '—' : `${pct}%`}
      </div>
      <div style={cap}>{hayBase ? 'de lo que ganaste' : 'Sin ingresos este mes'}</div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--muted)', overflow: 'hidden', marginTop: 'auto' }}>
        <div style={{ width: `${negativo || pct === null ? 0 : Math.min(100, pct)}%`, height: '100%', background: 'var(--yellow)', borderRadius: 3 }} />
      </div>
      <div style={cap}>{pct === null ? 'Registra un ingreso' : negativo ? 'Gastaste más de lo que entró' : pct >= 20 ? 'Vas bien' : 'Se puede mejorar'}</div>
    </div>
  );
}
