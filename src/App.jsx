import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileChartColumn,
  FileSpreadsheet,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { isSupabaseConfigured, supabase } from './lib/supabase.js'
import { parseCsvFile, summarizeCsv } from './lib/csv.js'
import { formatCurrency, formatDate, formatNumber, formatPercent } from './lib/format.js'

const STORAGE_BUCKET = 'portfolio-files'
const CHUNK_SIZE = 400

function classNames(...names) {
  return names.filter(Boolean).join(' ')
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return undefined

    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  if (!isSupabaseConfigured) return <ConfigurationScreen />
  if (loading) return <LoadingScreen label="Conectando con Supabase…" />
  if (!session) return <AuthScreen />
  return <Workspace session={session} />
}

function ConfigurationScreen() {
  return (
    <main className="center-page">
      <section className="setup-card">
        <div className="brand-mark"><BarChart3 size={22} /></div>
        <p className="eyebrow">CONFIGURACIÓN INICIAL</p>
        <h1>Conecta tu proyecto Supabase</h1>
        <p className="muted">Copia <code>.env.ejemplo</code> como <code>.env.local</code>, completa las variables y reinicia el servidor de desarrollo.</p>
        <div className="setup-list">
          <div><ShieldCheck size={18} /><span>Configura la URL y la clave publicable de Supabase.</span></div>
          <div><Sparkles size={18} /><span>Configura la API Key de Ollama Cloud para habilitar el agente.</span></div>
          <div><FileChartColumn size={18} /><span>Aplica la migración SQL de <code>supabase/migrations</code>.</span></div>
        </div>
      </section>
    </main>
  )
}

function LoadingScreen({ label }) {
  return <main className="center-page"><div className="loading-state"><LoaderCircle className="spin" size={24} /><span>{label}</span></div></main>
}

function AuthScreen() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    if (mode === 'signup' && !result.data.session) setNotice('Cuenta creada. Revisa tu correo para confirmar el acceso.')
  }

  return (
    <main className="auth-page">
      <div className="auth-visual">
        <div className="brand-lockup"><div className="brand-mark"><BarChart3 size={22} /></div><span>controla</span></div>
        <div className="visual-copy">
          <p className="eyebrow">ANALIZADOR DE GASTOS</p>
          <h1>Decisiones claras sobre la ejecución de tu portafolio.</h1>
          <p>Importa presupuesto y gasto real, identifica desviaciones y consulta tus datos con un agente especializado.</p>
        </div>
        <div className="visual-grid"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div>
      </div>
      <section className="auth-card">
        <div className="auth-card-header"><p className="eyebrow">ESPACIO PRIVADO</p><h2>{mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu acceso'}</h2><p className="muted">Tus archivos y análisis quedan aislados en Supabase.</p></div>
        <form onSubmit={submit} className="stack-form">
          <label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@organizacion.com" required /></label>
          <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" minLength={6} required /></label>
          {error && <InlineAlert>{error}</InlineAlert>}
          {notice && <InlineNotice>{notice}</InlineNotice>}
          <button className="primary-button wide" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <ArrowUpRight size={17} />}{mode === 'login' ? 'Ingresar' : 'Registrarme'}</button>
        </form>
        <button className="text-button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice('') }}>{mode === 'login' ? '¿Aún no tienes una cuenta? Regístrate' : 'Ya tengo una cuenta'}</button>
      </section>
    </main>
  )
}

function Workspace({ session }) {
  const [portfolios, setPortfolios] = useState([])
  const [portfolioId, setPortfolioId] = useState('')
  const [portfolioName, setPortfolioName] = useState('')
  const [summary, setSummary] = useState([])
  const [lastAnalysis, setLastAnalysis] = useState(null)
  const [budgetFile, setBudgetFile] = useState(null)
  const [actualFile, setActualFile] = useState(null)
  const [budgetParsed, setBudgetParsed] = useState(null)
  const [actualParsed, setActualParsed] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => { loadPortfolios() }, [])
  useEffect(() => { if (portfolioId) loadPortfolioData(portfolioId) }, [portfolioId])

  async function loadPortfolios() {
    const { data, error: queryError } = await supabase.from('portfolios').select('id,name,created_at').order('created_at', { ascending: false })
    if (queryError) { setError(queryError.message); return }
    setPortfolios(data ?? [])
    if (data?.length) setPortfolioId((current) => current || data[0].id)
  }

  async function loadPortfolioData(id) {
    setLoadingData(true)
    setError('')
    const [{ data: rows, error: summaryError }, { data: analyses, error: analysisError }] = await Promise.all([
      supabase.from('project_execution_summary').select('*').eq('portfolio_id', id).order('project_code'),
      supabase.from('analysis_runs').select('id,created_at,analysis_type,metrics').eq('portfolio_id', id).order('created_at', { ascending: false }).limit(1),
    ])
    setLoadingData(false)
    if (summaryError) setError(summaryError.message)
    else setSummary(rows ?? [])
    if (!analysisError) setLastAnalysis(analyses?.[0] ?? null)
  }

  async function createPortfolio(event) {
    event.preventDefault()
    if (!portfolioName.trim()) return
    setBusy(true)
    const { data, error: insertError } = await supabase.from('portfolios').insert({ name: portfolioName.trim(), owner_id: session.user.id }).select('id,name,created_at').single()
    setBusy(false)
    if (insertError) { setError(insertError.message); return }
    setPortfolios((current) => [data, ...current])
    setPortfolioId(data.id)
    setPortfolioName('')
    setMessage({ type: 'success', text: 'Portafolio creado.' })
  }

  async function selectFile(file, type) {
    if (!file) return
    setError('')
    try {
      const parsed = await parseCsvFile(file, type)
      if (type === 'budget') { setBudgetFile(file); setBudgetParsed(parsed) }
      else { setActualFile(file); setActualParsed(parsed) }
    } catch (parseError) {
      setError(`${file.name}: ${parseError.message}`)
    }
  }

  async function insertChunks(table, rows) {
    for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
      const { error: insertError } = await supabase.from(table).insert(rows.slice(index, index + CHUNK_SIZE))
      if (insertError) throw insertError
    }
  }

  async function importDatasets() {
    if (!portfolioId) { setError('Crea o selecciona un portafolio antes de importar.'); return }
    if (!budgetFile || !budgetParsed || !actualFile || !actualParsed) { setError('Selecciona los dos archivos CSV antes de importar.'); return }

    setBusy(true)
    setError('')
    setMessage(null)
    const createdImports = []
    try {
      const importDefinitions = [
        { type: 'budget', file: budgetFile, parsed: budgetParsed },
        { type: 'actual', file: actualFile, parsed: actualParsed },
      ]

      for (const definition of importDefinitions) {
        const { data: importRow, error: importError } = await supabase.from('imports').insert({
          portfolio_id: portfolioId,
          uploaded_by: session.user.id,
          source_type: definition.type,
          original_filename: definition.file.name,
          row_count: definition.parsed.rows.length,
          status: 'processing',
          is_active: false,
        }).select('id').single()
        if (importError) throw importError

        const safeName = definition.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `${session.user.id}/${portfolioId}/${importRow.id}/${safeName}`
        const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, definition.file, { contentType: 'text/csv', upsert: false })
        if (uploadError) throw uploadError
        const { error: pathError } = await supabase.from('imports').update({ storage_path: storagePath }).eq('id', importRow.id)
        if (pathError) throw pathError
        createdImports.push({ ...definition, id: importRow.id })
      }

      const projectMap = new Map()
      for (const row of [...budgetParsed.rows, ...actualParsed.rows]) {
        const current = projectMap.get(row.projectCode)
        projectMap.set(row.projectCode, { portfolio_id: portfolioId, project_code: row.projectCode, project_name: row.projectName || current?.project_name || row.projectCode })
      }
      const { error: projectError } = await supabase.from('projects').upsert([...projectMap.values()], { onConflict: 'portfolio_id,project_code' })
      if (projectError) throw projectError

      const { data: projectRows, error: projectQueryError } = await supabase.from('projects').select('id,project_code').eq('portfolio_id', portfolioId)
      if (projectQueryError) throw projectQueryError
      const projectIds = new Map(projectRows.map((row) => [row.project_code, row.id]))

      const budgetImport = createdImports.find((entry) => entry.type === 'budget')
      const actualImport = createdImports.find((entry) => entry.type === 'actual')
      await insertChunks('budget_lines', budgetParsed.rows.map((row) => ({ portfolio_id: portfolioId, import_id: budgetImport.id, project_id: projectIds.get(row.projectCode), month_label: row.month, budget_item: row.item, amount: row.amount, source_row: row.rowNumber })))
      await insertChunks('actual_lines', actualParsed.rows.map((row) => ({ portfolio_id: portfolioId, import_id: actualImport.id, project_id: projectIds.get(row.projectCode), month_label: row.month, actual_item: row.item, amount: row.amount, source_row: row.rowNumber })))

      for (const entry of createdImports) {
        const { error: deactivateError } = await supabase.from('imports').update({ is_active: false }).eq('portfolio_id', portfolioId).eq('source_type', entry.type).eq('is_active', true)
        if (deactivateError) throw deactivateError
        const { error: activateError } = await supabase.from('imports').update({ is_active: true, status: 'completed', completed_at: new Date().toISOString() }).eq('id', entry.id)
        if (activateError) throw activateError
      }

      const { data: freshSummary, error: freshSummaryError } = await supabase.from('project_execution_summary').select('*').eq('portfolio_id', portfolioId).order('project_code')
      if (freshSummaryError) throw freshSummaryError
      const metrics = getMetrics(freshSummary ?? [])
      const { data: analysis, error: analysisError } = await supabase.from('analysis_runs').insert({
        portfolio_id: portfolioId,
        created_by: session.user.id,
        analysis_type: 'portfolio_summary',
        budget_import_id: budgetImport.id,
        actual_import_id: actualImport.id,
        metrics,
      }).select('id,created_at,analysis_type,metrics').single()
      if (analysisError) throw analysisError

      setSummary(freshSummary ?? [])
      setLastAnalysis(analysis)
      setBudgetFile(null); setActualFile(null); setBudgetParsed(null); setActualParsed(null)
      setMessage({ type: 'success', text: `Importación completada: ${formatNumber(metrics.projects)} proyectos analizados.` })
    } catch (importError) {
      setError(importError.message || 'No fue posible completar la importación.')
      for (const entry of createdImports) await supabase.from('imports').update({ status: 'failed', error_message: importError.message }).eq('id', entry.id)
    } finally {
      setBusy(false)
    }
  }

  const selectedPortfolio = portfolios.find((portfolio) => portfolio.id === portfolioId)
  const metrics = useMemo(() => getMetrics(summary), [summary])
  const filteredSummary = useMemo(() => summary.filter((row) => `${row.project_code} ${row.project_name}`.toLowerCase().includes(filter.toLowerCase())), [summary, filter])

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark"><BarChart3 size={18} /></div><span>controla</span></div>
        <div className="topbar-divider" />
        <div className="portfolio-picker">
          <span className="eyebrow">PORTAFOLIO ACTIVO</span>
          <select value={portfolioId} onChange={(event) => setPortfolioId(event.target.value)} aria-label="Seleccionar portafolio">
            {!portfolios.length && <option value="">Sin portafolios</option>}
            {portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}
          </select>
        </div>
        <div className="topbar-actions">
          <span className="user-pill">{session.user.email}</span>
          <button className="icon-button" title="Cerrar sesión" onClick={() => supabase.auth.signOut()}><LogOut size={17} /></button>
        </div>
      </header>

      <main className="workspace">
        <section className="page-heading">
          <div><p className="eyebrow">CENTRO DE CONTROL</p><h1>{selectedPortfolio?.name || 'Tu portafolio'}</h1><p className="muted">Presupuesto versus ejecución real, con trazabilidad por proyecto y período.</p></div>
          <div className="heading-actions">
            {lastAnalysis && <span className="last-analysis"><CheckCircle2 size={15} /> Último análisis {formatDate(lastAnalysis.created_at)}</span>}
            <button className="secondary-button" onClick={() => portfolioId && loadPortfolioData(portfolioId)} disabled={loadingData}><RefreshCw className={classNames(loadingData && 'spin')} size={16} /> Actualizar</button>
          </div>
        </section>

        {error && <InlineAlert>{error}<button onClick={() => setError('')}><X size={15} /></button></InlineAlert>}
        {message && <InlineNotice>{message.text}<button onClick={() => setMessage(null)}><X size={15} /></button></InlineNotice>}

        <section className="workspace-grid">
          <div className="main-column">
            <PortfolioCreate name={portfolioName} setName={setPortfolioName} onSubmit={createPortfolio} busy={busy} />
            <UploadPanel budgetFile={budgetFile} actualFile={actualFile} budgetParsed={budgetParsed} actualParsed={actualParsed} onSelect={selectFile} onImport={importDatasets} busy={busy} />
            <MetricsGrid metrics={metrics} />
            <ChartPanel rows={filteredSummary} loading={loadingData} />
            <ProjectTable rows={filteredSummary} filter={filter} setFilter={setFilter} />
          </div>
          <ChatPanel session={session} portfolioId={portfolioId} disabled={!summary.length} />
        </section>
      </main>
    </div>
  )
}

function PortfolioCreate({ name, setName, onSubmit, busy }) {
  return (
    <section className="create-strip">
      <div className="section-icon"><Plus size={18} /></div>
      <div><strong>Nuevo portafolio</strong><span className="muted">Organiza cada conjunto de proyectos por separado.</span></div>
      <form onSubmit={onSubmit} className="inline-form"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del portafolio" /><button className="secondary-button" disabled={busy || !name.trim()}><Plus size={16} /> Crear</button></form>
    </section>
  )
}

function UploadPanel({ budgetFile, actualFile, budgetParsed, actualParsed, onSelect, onImport, busy }) {
  return (
    <section className="panel upload-panel">
      <div className="panel-heading"><div><p className="eyebrow">DATOS DE ENTRADA</p><h2>Carga los archivos de análisis</h2></div><span className="format-chip"><FileSpreadsheet size={15} /> CSV</span></div>
      <div className="upload-grid">
        <FileDrop type="budget" file={budgetFile} parsed={budgetParsed} onSelect={onSelect} />
        <FileDrop type="actual" file={actualFile} parsed={actualParsed} onSelect={onSelect} />
      </div>
      <div className="upload-footer"><span className="muted small">Columnas verificadas automáticamente según el formato del portafolio.</span><button className="primary-button" onClick={onImport} disabled={busy || !budgetParsed || !actualParsed}>{busy ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}{busy ? 'Procesando…' : 'Importar y analizar'}</button></div>
    </section>
  )
}

function FileDrop({ type, file, parsed, onSelect }) {
  const isBudget = type === 'budget'
  return (
    <label className={classNames('file-drop', file && 'has-file')}>
      <input type="file" accept=".csv,text/csv" onChange={(event) => onSelect(event.target.files?.[0], type)} />
      <div className="file-drop-icon">{file ? <CheckCircle2 size={19} /> : <Upload size={19} />}</div>
      <div className="file-drop-copy"><strong>{isBudget ? 'Presupuesto del portafolio' : 'Gasto real ejecutado'}</strong><span>{file ? file.name : 'Arrastra o selecciona un archivo CSV'}</span>{parsed && <small>{formatNumber(parsed.rows.length)} filas · {formatNumber(new Set(parsed.rows.map((row) => row.projectCode)).size)} proyectos</small>}</div>
      <span className="file-type">{isBudget ? 'BUDGET' : 'ACTUAL'}</span>
    </label>
  )
}

function MetricsGrid({ metrics }) {
  const cards = [
    { label: 'Presupuesto total', value: formatCurrency(metrics.budget), icon: CircleDollarSign, tone: 'blue' },
    { label: 'Gasto real', value: formatCurrency(metrics.actual), icon: ArrowUpRight, tone: 'orange' },
    { label: 'Saldo disponible', value: formatCurrency(metrics.balance), icon: ShieldCheck, tone: metrics.balance < 0 ? 'red' : 'green' },
    { label: 'Ejecución', value: formatPercent(metrics.execution), icon: BarChart3, tone: 'purple', note: `${formatNumber(metrics.projects)} proyectos` },
  ]
  return <section className="metrics-grid">{cards.map(({ label, value, icon: Icon, tone, note }) => <div className="metric-card" key={label}><div className={classNames('metric-icon', tone)}><Icon size={18} /></div><span className="metric-label">{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>)}</section>
}

function ChartPanel({ rows, loading }) {
  const data = rows.map((row) => ({ name: row.project_name || row.project_code, code: row.project_code, budget: Number(row.budgeted_amount) || 0, actual: Number(row.actual_amount) || 0 })).slice(0, 24)
  return (
    <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">EJECUCIÓN POR PROYECTO</p><h2>Presupuesto frente a gasto real</h2></div><span className="muted small">{rows.length > 24 ? 'Mostrando los primeros 24 proyectos' : `${rows.length} proyectos`}</span></div>
      <div className="chart-wrap">{loading ? <LoadingState label="Calculando indicadores…" /> : !data.length ? <EmptyState icon={BarChart3} title="Aún no hay datos para graficar" text="Carga los dos CSV para visualizar la ejecución del portafolio." /> : <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 12, right: 12, left: 4, bottom: 72 }} barGap={4}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6ebf2" /><XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} height={78} tick={{ fill: '#70809a', fontSize: 11 }} tickFormatter={(value) => value.length > 18 ? `${value.slice(0, 18)}…` : value} /><YAxis tick={{ fill: '#70809a', fontSize: 11 }} tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : value} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => formatCurrency(value)} labelFormatter={(label, payload) => payload?.[0]?.payload?.code || label} contentStyle={{ borderRadius: 14, border: '1px solid #e6ebf2', boxShadow: '0 12px 30px rgba(16, 37, 63, .12)' }} /><Legend verticalAlign="top" align="right" height={36} iconType="circle" /><Bar dataKey="budget" name="Presupuesto" fill="#7c8cff" radius={[5, 5, 0, 0]} maxBarSize={24} /><Bar dataKey="actual" name="Gasto real" fill="#f3a55b" radius={[5, 5, 0, 0]} maxBarSize={24} /></BarChart></ResponsiveContainer>}</div>
    </section>
  )
}

function ProjectTable({ rows, filter, setFilter }) {
  return <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">DETALLE</p><h2>Resumen por proyecto</h2></div><input className="search-input" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Buscar proyecto…" /></div>{!rows.length ? <EmptyState icon={FileChartColumn} title="Sin proyectos" text="El detalle aparecerá cuando exista una importación válida." /> : <div className="table-scroll"><table><thead><tr><th>Proyecto</th><th>Presupuesto</th><th>Gasto real</th><th>Saldo</th><th>Ejecución</th></tr></thead><tbody>{rows.map((row) => { const budget = Number(row.budgeted_amount) || 0; const actual = Number(row.actual_amount) || 0; const execution = budget ? actual / budget * 100 : 0; return <tr key={row.project_id}><td><strong>{row.project_name || row.project_code}</strong><small>{row.project_code}</small></td><td>{formatCurrency(budget)}</td><td>{formatCurrency(actual)}</td><td className={actual > budget ? 'negative' : 'positive'}>{formatCurrency(budget - actual)}</td><td><div className="progress-cell"><div className="progress-track"><span className={actual > budget ? 'over' : ''} style={{ width: `${Math.min(execution, 100)}%` }} /></div><span>{formatPercent(execution)}</span></div></td></tr>})}</tbody></table></div>}</section>
}

function ChatPanel({ session, portfolioId, disabled }) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hola. Puedo analizar el presupuesto, el gasto real, la ejecución y las desviaciones de este portafolio. ¿Qué quieres revisar?' }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [error, setError] = useState('')

  async function send(event) {
    event?.preventDefault()
    const content = input.trim()
    if (!content || sending || disabled) return
    setInput('')
    setError('')
    const nextMessages = [...messages, { role: 'user', content }, { role: 'assistant', content: '', pending: true }]
    setMessages(nextMessages)
    setSending(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ portfolioId, sessionId, message: content, history: messages.filter((message) => message.role !== 'system').slice(-8) }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'El agente no pudo procesar la consulta.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let answer = ''
      const processEvent = (rawEvent) => {
        const line = rawEvent.split(/\r?\n/).find((line) => line.startsWith('data:'))
        if (!line) return
        const payload = JSON.parse(line.slice(5).trim())
        if (payload.sessionId) setSessionId(payload.sessionId)
        if (payload.delta) {
          answer += payload.delta
          setMessages((current) => current.map((item, index) => index === current.length - 1 ? { role: 'assistant', content: answer } : item))
        }
      }
      while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''
        events.forEach(processEvent)
        if (done) break
      }
      if (!answer) throw new Error('El agente devolvió una respuesta vacía.')
    } catch (sendError) {
      setError(sendError.message)
      setMessages((current) => current.slice(0, -1))
    } finally {
      setSending(false)
    }
  }

  return <aside className="chat-panel"><div className="chat-header"><div className="chat-title"><div className="agent-avatar"><Bot size={18} /></div><div><strong>Analista de portafolio</strong><span><span className="online-dot" /> Ollama Cloud · solo datos</span></div></div><span className="scope-badge"><ShieldCheck size={13} /> Datos internos</span></div><div className="chat-body">{disabled ? <EmptyState icon={MessageSquareText} title="Chat en pausa" text="Importa presupuesto y gasto real para comenzar a consultar." /> : messages.map((message, index) => <div key={`${message.role}-${index}`} className={classNames('chat-message', message.role)}>{message.role === 'assistant' && <div className="mini-avatar"><Bot size={13} /></div>}<div className="message-bubble">{message.pending ? <span className="typing"><i /><i /><i /></span> : message.content}</div></div>)}</div><div className="chat-suggestions">{['¿Cuál es la ejecución total?', '¿Qué proyecto tiene mayor desviación?'].map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)} disabled={disabled || sending}>{suggestion}</button>)}</div>{error && <div className="chat-error"><AlertCircle size={14} />{error}</div>}<form className="chat-input" onSubmit={send}><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={disabled ? 'Primero carga los archivos…' : 'Pregunta sobre tu portafolio…'} disabled={disabled || sending} rows={2} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event) } }} /><button type="submit" className="send-button" disabled={!input.trim() || disabled || sending}><Send size={17} /></button></form><p className="chat-disclaimer"><ShieldCheck size={12} /> El agente rechaza preguntas ajenas a los datos cargados.</p></aside>
}

function InlineAlert({ children }) { return <div className="inline-alert"><AlertCircle size={16} /><span>{children}</span></div> }
function InlineNotice({ children }) { return <div className="inline-notice"><CheckCircle2 size={16} /><span>{children}</span></div> }
function LoadingState({ label }) { return <div className="empty-state"><LoaderCircle className="spin" size={23} /><strong>{label}</strong></div> }
function EmptyState({ icon: Icon, title, text }) { return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><strong>{title}</strong><span>{text}</span></div> }

function getMetrics(rows) {
  const budget = rows.reduce((sum, row) => sum + (Number(row.budgeted_amount) || 0), 0)
  const actual = rows.reduce((sum, row) => sum + (Number(row.actual_amount) || 0), 0)
  return { budget, actual, balance: budget - actual, execution: budget ? actual / budget * 100 : 0, projects: rows.length }
}

export default App
