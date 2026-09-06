import Papa from 'papaparse'

const HEADER_ALIASES = {
  projectCode: 'codigo proyecto',
  projectName: 'nombre proyecto',
  budgetMonth: 'mes presupuesto',
  budgetItem: 'partida presupuesto',
  budgetAmount: 'monto presupuesto',
  actualMonth: 'mes gasto',
  actualItem: 'partida gasto',
  actualAmount: 'monto gasto',
}

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

export function parseAmount(value) {
  const source = normalizeText(value)
  if (!source) return null

  const negative = /^\(.*\)$/.test(source) || source.includes('-')
  const clean = source.replace(/[()\sA-Za-z$€£]/g, '').replace(/[^\d,.-]/g, '')
  if (!clean) return null

  let normalized = clean
  const lastComma = clean.lastIndexOf(',')
  const lastDot = clean.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      normalized = clean.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = clean.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    const decimals = clean.length - lastComma - 1
    normalized = decimals > 0 && decimals <= 2 ? clean.replace(',', '.') : clean.replace(/,/g, '')
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return negative ? -Math.abs(parsed) : parsed
}

function getValue(row, targetHeader) {
  const key = Object.keys(row).find((candidate) => normalizeHeader(candidate) === targetHeader)
  return key ? row[key] : undefined
}

function requiredHeaders(type) {
  return type === 'budget'
    ? [HEADER_ALIASES.projectCode, HEADER_ALIASES.projectName, HEADER_ALIASES.budgetMonth, HEADER_ALIASES.budgetItem, HEADER_ALIASES.budgetAmount]
    : [HEADER_ALIASES.projectCode, HEADER_ALIASES.actualMonth, HEADER_ALIASES.actualItem, HEADER_ALIASES.actualAmount]
}

export function parseCsvFile(file, type) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      delimiter: '',
      complete: (result) => {
        const fields = result.meta?.fields ?? []
        const normalizedFields = new Set(fields.map(normalizeHeader))
        const missing = requiredHeaders(type).filter((header) => !normalizedFields.has(header))

        if (missing.length) {
          reject(new Error(`Faltan columnas obligatorias: ${missing.join(', ')}`))
          return
        }

        const rows = result.data
          .map((row, index) => {
            const code = normalizeText(getValue(row, HEADER_ALIASES.projectCode))
            const item = normalizeText(getValue(row, type === 'budget' ? HEADER_ALIASES.budgetItem : HEADER_ALIASES.actualItem))
            const month = normalizeText(getValue(row, type === 'budget' ? HEADER_ALIASES.budgetMonth : HEADER_ALIASES.actualMonth))
            const amount = parseAmount(getValue(row, type === 'budget' ? HEADER_ALIASES.budgetAmount : HEADER_ALIASES.actualAmount))

            return {
              rowNumber: index + 2,
              projectCode: code,
              projectName: type === 'budget' ? normalizeText(getValue(row, HEADER_ALIASES.projectName)) : '',
              month,
              item,
              amount,
            }
          })
          .filter((row) => row.projectCode || row.item || row.month || row.amount !== null)

        const invalidRows = rows.filter((row) => !row.projectCode || !row.month || !row.item || row.amount === null)
        if (invalidRows.length) {
          reject(new Error(`Hay ${invalidRows.length} fila(s) incompleta(s). Revisa código, mes, partida y monto.`))
          return
        }

        resolve({ rows, fields, warnings: result.errors ?? [] })
      },
      error: (error) => reject(error),
    })
  })
}

export function summarizeCsv(parsed, type) {
  const projects = new Set(parsed.rows.map((row) => row.projectCode))
  const total = parsed.rows.reduce((sum, row) => sum + row.amount, 0)
  return {
    type,
    rows: parsed.rows.length,
    projects: projects.size,
    total,
  }
}
