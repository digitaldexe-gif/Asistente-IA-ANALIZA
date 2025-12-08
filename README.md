# Laboratorios Analiza - AI Backend

Backend de inteligencia artificial para Laboratorios Analiza con integración de OpenAI Realtime API.

## 🚀 Deploy en Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

### Variables de Entorno Requeridas

Copia `.env.example` a `.env` y configura:

- `PORT`: Puerto del servidor (Railway lo asigna automáticamente)
- `OPENAI_API_KEY`: Tu API key de OpenAI (requerido)
- `APP_MODE`: `demo` o `production`
- `TWILIO_ACCOUNT_SID`: (opcional) Para integración telefónica
- `TWILIO_AUTH_TOKEN`: (opcional) Para integración telefónica
- `N8N_WEBHOOK_BASE_URL`: (opcional) Para modo producción
- `DATABASE_URL`: (opcional) Para memoria persistente con PostgreSQL

### Instalación Local

```bash
npm install
npm run build
npm start
```

### Desarrollo

```bash
npm run dev
```

## 📋 Características

- ✅ API REST con Fastify
- ✅ WebSocket para streaming en tiempo real
- ✅ Integración con OpenAI Realtime API
- ✅ Gestión de agenda y citas
- ✅ Base de conocimiento médico
- ✅ Memoria persistente de pacientes
- ✅ Compatible con Railway deployment

## 🔧 Endpoints

- `GET /health` - Health check
- `GET /patients` - Lista de pacientes
- `GET /appointments` - Citas programadas
- `WS /media-stream` - WebSocket para audio streaming

## 📦 Stack Tecnológico

- Node.js 18+
- TypeScript
- Fastify
- Prisma (opcional)
- OpenAI Realtime API
- WebSocket
