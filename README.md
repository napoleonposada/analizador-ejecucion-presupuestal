# Analizador de ejecución presupuestal

Aplicación React para comparar presupuesto y gasto real de un portafolio de proyectos. Los CSV originales se conservan en Supabase Storage; sus filas normalizadas se guardan en Supabase Postgres; el chat consulta únicamente el portafolio activo mediante Ollama Cloud.

## Aplicación desplegada

La versión desplegada para verificación está disponible en:

<https://analizador-ejecucion-presupuestal.vercel.app/>

El proyecto está configurado como repositorio privado y utiliza Vercel Functions para el backend.

## Formato de los CSV

Presupuesto:

```text
codigo proyecto,nombre proyecto,mes presupuesto,partida presupuesto,monto presupuesto
```

Gasto real:

```text
codigo proyecto,mes gasto,partida gasto,monto gasto
```

Se aceptan separadores detectados automáticamente por PapaParse y montos con formato decimal español o anglosajón.

## Configuración local

1. Copiar `.env.ejemplo` a `.env.local` y completar los valores.
2. Crear un proyecto Supabase y habilitar autenticación por correo electrónico.
3. Ejecutar el SQL de `supabase/migrations/20260906000000_initial_schema.sql` en el SQL Editor de Supabase.
4. Instalar dependencias: `npm install`.
5. Iniciar: `npm run dev`.

`npm run dev` sirve el frontend. Para ejecutar también las funciones `/api` durante el desarrollo local, usa Vercel CLI con `vercel dev` desde la raíz del proyecto.

La migración inicial debe ejecutarse una vez por proyecto Supabase. Crea las tablas `portfolios`, `projects`, `imports`, `budget_lines`, `actual_lines`, `analysis_runs` y las tablas del chat, además de vistas, índices, Storage privado y políticas RLS.

La clave `SUPABASE_SERVICE_ROLE_KEY` no se utiliza en el frontend y nunca debe comenzar con `VITE_`. La API de Ollama se invoca solo desde `api/chat.js`. `SUPABASE_URL` debe contener la misma URL del proyecto que `VITE_SUPABASE_URL`.

## Despliegue en Vercel

Importar el repositorio en Vercel, configurar las variables de `.env.ejemplo` en el entorno de producción y desplegar. `vercel.json` configura el build de Vite y el tiempo máximo de la función de chat.

## Persistencia y seguridad

- RLS está habilitado en las tablas públicas.
- Cada portafolio se restringe por propietario o miembro.
- El bucket `portfolio-files` es privado y las rutas empiezan por el UUID del usuario.
- Cada importación conserva su archivo original, filas, estado, fecha y si es la versión activa.
- Cada resumen y pregunta de chat se guarda en `analysis_runs` con `created_at`.
- Los archivos `.env`, `.env.local` y `.vercel` no deben versionarse.
- Los CSV de ejemplo del proyecto pueden versionarse porque este repositorio es privado; no incluir datos reales sin revisar su clasificación y permisos.

## Repositorio

El código fuente se publica en un repositorio privado de GitHub. Las credenciales deben configurarse en Vercel y localmente mediante archivos `.env` ignorados por Git, nunca dentro del repositorio.
