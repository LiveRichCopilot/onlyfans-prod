# Reporte de Funciones y Suministros — OF HQ

## Resumen ejecutivo

Este documento lista todas las funciones (páginas, APIs, crons) del proyecto y los suministros externos (APIs, claves, créditos) que consume cada una.

---

## 1. PÁGINAS / FUNCIONES DE USUARIO

| Ruta | Función | Suministros que consume |
|------|---------|-------------------------|
| `/` | Dashboard principal (overview de creadores, revenue) | POSTGRES_URL, OFAPI_API_KEY (auto-sync perfiles) |
| `/login` | Inicio de sesión con Google | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET |
| `/onboarding` | Onboarding de nuevos usuarios | — |
| `/inbox` | Bandeja de mensajes en vivo (chats OF) | POSTGRES_URL, OFAPI_API_KEY |
| `/inbox` → AI hints | Sugerencias de respuesta con IA | OPENAI_API_KEY (gpt-5-mini) |
| `/inbox` → clasificar fan | Clasificación IA del fan (tipo, intención) | OPENAI_API_KEY (gpt-5-mini) |
| `/inbox` → vault tag | Etiquetar contenido del vault con IA | OPENAI_API_KEY (gpt-5-mini) |
| `/performance` | Rendimiento de chatters (scores en vivo) | POSTGRES_URL |
| `/team` | Gestión de equipo (invitar, roles) | POSTGRES_URL |
| `/team-analytics` | Analíticas de equipo (wiring, reportes) | POSTGRES_URL, OFAPI_API_KEY, Hubstaff (mappings) |
| `/team/hubstaff` | Integración Hubstaff (clock-in, mappings) | POSTGRES_URL, Hubstaff API (token en DB) |
| `/schedule` | Horarios de turnos | POSTGRES_URL |
| `/content-daily` | Contenido diario (DMs, posts) | POSTGRES_URL, OFAPI_API_KEY |
| `/content-feed` | Feed de contenido | POSTGRES_URL, OFAPI_API_KEY |
| `/chatter` | Página de chatters | POSTGRES_URL |
| `/chatter/live` | Chatter en vivo con Hubstaff | POSTGRES_URL, Hubstaff API |
| `/chatter/scores` | Puntuaciones de chatters | POSTGRES_URL |
| `/analytics` | Analíticas de revenue | POSTGRES_URL |
| `/reports` | Reportes | POSTGRES_URL |
| `/cfo` | Vista CFO | POSTGRES_URL |
| `/upload` | Subida de contenido | POSTGRES_URL |
| `/creators/[id]` | Perfil de creador | POSTGRES_URL |
| `/system` | Intelligence overview (stats BD) | POSTGRES_URL |

---

## 2. CRONS (tareas programadas)

| Cron | Frecuencia | Función | Suministros |
|------|------------|---------|-------------|
| `hourly-report` | Cada hora (0 * * * *) | Reporte por hora | CRON_SECRET, POSTGRES_URL |
| `sync-transactions` | Cada 5 min | Sincronizar transacciones OF | CRON_SECRET, POSTGRES_URL, OFAPI_API_KEY |
| `stage-decay` | 6:00 UTC diario | Decaimiento de stage de fans | CRON_SECRET, POSTGRES_URL |
| `online-poll` | Cada 2 min | Poll fans online | CRON_SECRET, POSTGRES_URL, OFAPI_API_KEY |
| `follow-ups` | Cada 6 h | Generar follow-ups con IA | CRON_SECRET, TELEGRAM_BOT_TOKEN, OPENAI_API_KEY (gpt-5-mini) |
| `performance-score` | Cada 30 min | Calcular puntuación de chatters | CRON_SECRET, POSTGRES_URL, MOONSHOT_API_KEY (kimi-k2.5), OFAPI_API_KEY |
| `hubstaff-sync` | Cada 5 min | Sincronizar Hubstaff (clock-in/out) | CRON_SECRET, POSTGRES_URL, Hubstaff (token en DB) |
| `mass-reply-attribution` | Cada 30 min | Atribuir mass replies a chatters | CRON_SECRET, POSTGRES_URL |
| `creator-report` | 6:00 UTC diario | Reporte por creador (OFAPI earnings) | CRON_SECRET, POSTGRES_URL, OFAPI_API_KEY |
| `sync-messages` | Cada 2 min | Sincronizar mensajes de chats | CRON_SECRET, POSTGRES_URL, OFAPI_API_KEY |
| `sync-dm-engagement` | Cada 15 min | Sincronizar engagement de DMs | CRON_SECRET, POSTGRES_URL, OFAPI_API_KEY |
| `sync-mass-message-chart` | Cada 15 min | Gráfico mass messages | CRON_SECRET, POSTGRES_URL, OFAPI_API_KEY |
| `sync-mass-message-stats` | Cada 15 min | Stats mass messages | CRON_SECRET, POSTGRES_URL, OFAPI_API_KEY |
| `sync-outbound-content` | Cada 10 min | Sincronizar contenido outbound | CRON_SECRET, POSTGRES_URL |
| `sync-chargebacks` | Cada 30 min | Sincronizar chargebacks | CRON_SECRET, POSTGRES_URL, OFAPI_API_KEY |

**Crons de backfill** (manuales o puntuales):
- `backfill-messages`, `backfill-dm-media`, `backfill-dm-raw` — OFAPI_API_KEY

**Otros crons no en vercel.json:**
- `auto-clock-in` — Hubstaff clock-in automático
- `qa-batch` — QA scoring (OPENAI_API_KEY gpt-5-mini)

---

## 3. SUMINISTROS EXTERNOS (env vars y costes estimados)

### 3.1 Base de datos
| Variable | Uso | Coste |
|---------|-----|-------|
| `POSTGRES_URL` | Prisma / Supabase PostgreSQL | Plan Supabase/Neon (según tier) |
| `POSTGRES_URL_NON_POOLING` | Migraciones, triggers | Idem |

### 3.2 OnlyFans API (OFAPI)
| Variable | Uso | Coste |
|---------|-----|-------|
| `OFAPI_API_KEY` | Chats, mensajes, transacciones, fans, revenue, chargebacks, accounts | Plan OnlyFansAPI.com (según suscripción) |

**Consumido por:** inbox, creators, sync-transactions, sync-messages, online-poll, creator-report, sync-chargebacks, sync-dm-engagement, sync-mass-message-*, content-daily, content-feed, fan-details, ppv-history, etc.

### 3.3 OpenAI
| Variable | Uso | Modelo | Coste aprox. |
|---------|-----|--------|--------------|
| `OPENAI_API_KEY` | AI hints, clasificador, vault tagger, closing hints, ghost writer, QA score, follow-ups | gpt-5-mini | $0.25/M in, $2/M out |
| | Revenue reasoning | gpt-5.2 | Flagship pricing |

**Archivos:** `lib/ai-classifier.ts`, `lib/ai-closing-hints.ts`, `lib/ai-ghost-writer.ts`, `lib/ai-vault-tagger.ts`, `lib/ai-revenue.ts`, `app/api/inbox/ai-hints/route.ts`, `app/api/inbox/qa-score/route.ts`, `app/api/cron/follow-ups/route.ts`, `lib/screenshot-analyzer.ts`

### 3.4 Moonshot (Kimi)
| Variable | Uso | Modelo | Coste aprox. |
|---------|-----|--------|--------------|
| `MOONSHOT_API_KEY` | Chatter scoring, story analyzer | kimi-k2.5 (256K ctx) | $0.60/M in, $3/M out |
| `KIMI_API_KEY` | Caption rewrite (alternativa) | — | Idem |

**Archivos:** `lib/chatter-scoring-prompt.ts`, `lib/chatter-story-analyzer.ts`, `app/api/team-analytics/caption-rewrite/route.ts`, `app/api/cron/performance-score/route.ts`

### 3.5 Hubstaff
| Variable | Uso | Coste |
|---------|-----|-------|
| Token en DB (`HubstaffConfig`) | Actividad, screenshots, attendance, members | Plan Hubstaff |

**Consumido por:** `/team/hubstaff`, `hubstaff-sync` cron, `auto-clock-in`, wiring/timeline/team-reports.

### 3.6 Autenticación
| Variable | Uso | Coste |
|---------|-----|-------|
| `GOOGLE_CLIENT_ID` | OAuth Google | Gratis |
| `GOOGLE_CLIENT_SECRET` | OAuth Google | Gratis |
| `NEXTAUTH_SECRET` | Sesiones NextAuth | — |
| `NEXTAUTH_URL` | URL base | — |

### 3.7 Telegram
| Variable | Uso | Coste |
|---------|-----|-------|
| `TELEGRAM_BOT_TOKEN` | Envío de follow-ups, alertas | Gratis (Bot API) |

**Consumido por:** `app/api/cron/follow-ups/route.ts`, `lib/telegram-bot.ts`, `lib/telegram-media.ts`, `lib/telegram-reports.ts`

### 3.8 Supabase (opcional)
| Variable | Uso | Coste |
|---------|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente Supabase | Plan Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente | — |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Storage (sync-content) | — |

### 3.9 Otros
| Variable | Uso | Coste |
|---------|-----|-------|
| `CRON_SECRET` | Proteger crons en prod | — |
| `GEMINI_API_KEY` | Análisis de screenshots (ai-analyzer) | Opcional / fallback |
| `VERCEL_TOKEN` | Logs/deploy (scripts) | — |

---

## 4. MATRIZ FUNCIÓN → SUMINISTRO

| Suministro | Funciones que lo consumen |
|------------|--------------------------|
| **POSTGRES_URL** | Casi todas las páginas, APIs y crons |
| **OFAPI_API_KEY** | Inbox, creators, sync-transactions, sync-messages, online-poll, creator-report, sync-chargebacks, sync-dm-engagement, sync-mass-message-*, content-daily, content-feed, performance, fan-details, ppv-history |
| **OPENAI_API_KEY** | AI hints, clasificador, vault tagger, closing hints, QA batch, follow-ups, revenue |
| **MOONSHOT_API_KEY** | Chatter scoring, performance-score cron, caption-rewrite, story analyzer |
| **Hubstaff** | team/hubstaff, hubstaff-sync, auto-clock-in, team-analytics wiring |
| **TELEGRAM_BOT_TOKEN** | follow-ups cron (enviar mensajes) |
| **GOOGLE_*** | Login |
| **CRON_SECRET** | Todos los crons en producción |

---

## 5. COSTES ESTIMADOS (mensual, orden de magnitud)

| Proveedor | Uso típico | Estimación |
|-----------|------------|------------|
| **OpenAI (gpt-5-mini)** | ~1–5M tokens/día (hints, clasificaciones, QA) | $50–200/mes |
| **OpenAI (gpt-5.2)** | Uso puntual (revenue) | Bajo |
| **Moonshot (kimi-k2.5)** | Scoring chatters cada 30 min, análisis de historias | $30–100/mes |
| **OFAPI** | Según plan OnlyFansAPI.com | Según suscripción |
| **Supabase/Postgres** | BD principal | Según tier |
| **Hubstaff** | Según plan | Según suscripción |
| **Vercel** | Hosting Next.js | Plan free/pro |

---

*Documento generado a partir del análisis del código. Actualizar si se añaden nuevas integraciones.*
