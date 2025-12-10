# 📘 Documentación Técnica - Laboratorios Analiza (Backend Autónomo)

Esta documentación refleja **exactamente** la implementación actual del código en producción (`web-production-6e86.up.railway.app`). Úsala para verificar el funcionamiento y configurar integraciones.

---

## 1. WebSocket: Chat Realtime (`/chat/realtime`)

**Endpoint**: `wss://web-production-6e86.up.railway.app/chat/realtime`
**Implementación**: `src/voice/providers/ChatWebSocketProvider.ts`

### Protocolo de Mensajes (JSON)

#### Cliente → Backend

**1. Enviar Texto**
```json
{
  "event": "text",
  "text": "Hola, quisiera agendar una cita para mañana."
}
```

**2. Enviar Audio (PCM16 Base64)**
```json
{
  "event": "media",
  "media": {
    "payload": "<BASE64_PCM16_RAW_AUDIO>"
  }
}
```

#### Backend → Cliente

**1. Respuesta Texto (IA)**
```json
{
  "event": "text",
  "text": "Con gusto. Por favor, proporcione su código GOES para continuar."
}
```

**2. Respuesta Audio (PCM16 Base64)**
```json
{
  "event": "media",
  "media": {
    "payload": "<BASE64_PCM16_RAW_AUDIO>"
  }
}
```

**3. Error**
```json
{
  "event": "error",
  "message": "OpenAI API Key Invalid",
  "code": 4001
}
```

---

## 2. API REST Endpoints

Todos los endpoints (excepto GET) requieren el header:
`Content-Type: application/json`

Todos los endpoints retornan estructuras consistentes:
*   **Éxito**: `{ "success": true, "data": ... }`
*   **Error**: `{ "success": false, "error": "Mensaje descriptivo" }`

### 📅 Agenda (Integración Bolt.new)

**1. Consultar Cupos Disponibles**
*   **Método**: `GET`
*   **URL**: `/api/appointments/available`
*   **Query Params**:
    *   `branchId` (Requerido): ID de la sucursal (ej: `SS-001`).
    *   `examCode` (Opcional): Código del examen.
    *   `date` (Opcional): Fecha específica `YYYY-MM-DD`.
*   **Ejemplo Request**:
    `GET https://web-production-6e86.up.railway.app/api/appointments/available?branchId=SS-001&date=2024-12-15`
*   **Ejemplo Response Real**:
    ```json
    {
      "success": true,
      "data": [
        {
          "slotId": "SLOT-0800",
          "start": "2024-12-15T08:00:00.000Z",
          "end": "2024-12-15T08:30:00.000Z",
          "branchId": "SS-001",
          "isBooked": false
        },
        {
          "slotId": "SLOT-0830",
          "start": "2024-12-15T08:30:00.000Z",
          "end": "2024-12-15T09:00:00.000Z",
          "branchId": "SS-001",
          "isBooked": false
        }
      ],
      "count": 2
    }
    ```

**2. Reservar Cita**
*   **Método**: `POST`
*   **URL**: `/api/appointments/book`
*   **JSON Request**:
    ```json
    {
      "patientId": "PAT-170923",
      "slotId": "SLOT-0800",
      "examCode": "HEMO-001"
    }
    ```
*   **Ejemplo Response Real**:
    ```json
    {
      "success": true,
      "message": "Appointment booked successfully",
      "data": {
        "slotId": "SLOT-0800",
        "patientId": "PAT-170923",
        "examCode": "HEMO-001",
        "status": "booked"
      }
    }
    ```

**3. Simular Re-agendamiento**
*   **Método**: `POST`
*   **URL**: `/api/appointments/reschedule`
*   **JSON Request**:
    ```json
    {
      "appointmentId": "APT-555",
      "newSlotId": "SLOT-0900"
    }
    ```
*   **Ejemplo Response Real**:
    ```json
    {
      "success": true,
      "message": "Reschedule simulated",
      "data": {
        "appointmentId": "APT-555",
        "newSlotId": "SLOT-0900",
        "status": "rescheduled"
      }
    }
    ```

**4. Simular Cancelación**
*   **Método**: `POST`
*   **URL**: `/api/appointments/cancel`
*   **JSON Request**:
    ```json
    {
      "appointmentId": "APT-555"
    }
    ```
*   **Ejemplo Response Real**:
    ```json
    {
      "success": true,
      "message": "Cancellation simulated",
      "data": {
        "appointmentId": "APT-555",
        "status": "cancelled"
      }
    }
    ```

---

### 🏥 Gestión de Pacientes y GOES

**1. Validar Código GOES**
*   **Método**: `POST`
*   **URL**: `/api/validate-goes-code`
*   **JSON Request**:
    ```json
    {
      "goesCode": "123456"
    }
    ```
*   **Ejemplo Response Real** (Válido):
    ```json
    {
      "success": true,
      "valid": true,
      "data": {
        "patient": {
          "name": "Maria",
          "surname": "Lopez",
          "document": "05555555-5"
        },
        "exam": {
          "id": 101,
          "name": "Perfil Lipídico"
        }
      }
    }
    ```
*   **Ejemplo Response Real** (Inválido):
    ```json
    {
      "success": true,
      "valid": false,
      "message": "Code not found, already used, or expired"
    }
    ```

**2. Sincronizar Paciente (Vertical DB)**
*   **Método**: `POST`
*   **URL**: `/api/sync-patient`
*   **Descripción**: Crea el paciente en la DB local si no existe y marca el código GOES como usado.
*   **JSON Request**:
    ```json
    {
      "goesCode": "123456",
      "patientData": {
        "name": "Maria",
        "surname": "Lopez",
        "document": "05555555-5"
      },
      "examData": {
        "examId": 101,
        "examName": "Perfil Lipídico"
      }
    }
    ```
*   **Ejemplo Response Real**:
    ```json
    {
      "success": true,
      "data": {
        "patientId": "cm4hg8...",
        "created": true,
        "updated": false
      }
    }
    ```

**3. Gestión de Pacientes ("Multi-Action")**
*   **Método**: `POST`
*   **URL**: `/api/patient`
*   **JSON Request (Crear)**:
    ```json
    {
      "action": "create_patient",
      "name": "Carlos",
      "surname": "Ruiz",
      "phone": "+50370000000"
    }
    ```
*   **JSON Request (Obtener)**:
    ```json
    {
      "action": "get_patient",
      "patientId": "cm4hg8..."
    }
    ```
*   **Ejemplo Response Real**:
    ```json
    {
      "success": true,
      "data": {
        "id": "cm4hg8...",
        "name": "Carlos",
        "surname": "Ruiz",
        "primaryGoesCode": null,
        "phones": [ ... ]
      }
    }
    ```

**4. Historial de Interacciones**
*   **Método**: `POST`
*   **URL**: `/api/history`
*   **JSON Request**:
    ```json
    {
      "action": "get_history",
      "patientId": "cm4hg8..."
    }
    ```
*   **Ejemplo Response Real**:
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "...",
          "summary": "GOES code 123456 validated...",
          "outcome": "goes_validated",
          "date": "2024-12-10T..."
        }
      ],
      "count": 1
    }
    ```

---

## 3. OpenAI Tools (`tools.ts`) vs Implementación (`core.ts`)

Estas herramientas son las que el modelo de IA "decide" usar. El `OpenAICore` las intercepta y ejecuta la lógica interna.

| Tool Name | Parámetros (Ejemplo) | Lógica Interna | Ejemplo Retorno al Modelo |
| :--- | :--- | :--- | :--- |
| `validate_goes_code` | `{ "goesCode": "123456" }` | Llama a `GoesService.validateCode()` | `{ "valid": true, "patient": { "name": "Maria"... } }` |
| `sync_patient_to_vertical` | `{ "goesCode": "123456", "patientName": "Maria"... }` | `MemoryService.createPatient` + `GoesService.markAsUsed` | `{ "success": true, "patientId": "...", "patientContext": {...} }` |
| `get_available_slots` | `{ "branchId": "SS-001", "date": "2024-12-15" }` | `ScheduleService.getAvailableSlots(branch, date)` | `{ "slots": [{ "start": "..." }] }` |
| `book_slot` | `{ "slotId": "SLOT-0800", "patientId": "..." }` | `ScheduleService.markAsBooked(slotId)` | `{ "success": true, "message": "Cita confirmada exitosamente." }` |
| `suggest_best_slot` | `{ "patientId": "...", "branchId": "..." }` | `ScheduleService.suggestBestSlot()` (Usa historial previo) | `{ "slot": { "start": "..." } }` |
| `search_knowledge` | `{ "query": "precio hemograma" }` | `KbService.searchKnowledge(query)` | `{ "results": ["El hemograma cuesta $15..."] }` |
| `get_branches` | `{ "city": "San Salvador" }` | `KbService.getBranches(city)` | `{ "branches": [{ "name": "Sucursal Escalón"... }] }` |

---

## 4. Notas de Verificación

*   ✅ **N8n Desactivado**: No hay referencias a endpoints externos de N8n en el código activo.
*   ✅ **Autonomía**: Todas las validaciones de código GOES y reservas suceden en memoria o DB local.
*   ✅ **Agenda**: Los endpoints `/api/appointments/*` están listos para ser consumidos por el Frontend Agendador.
