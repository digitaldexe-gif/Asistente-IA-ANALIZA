require(Modules.AI);

// --- CONFIGURATION ---
// REPLACE WITH YOUR PRODUCTION BACKEND URL (without https://)
// Example: web-production-6e86.up.railway.app
const BACKEND_DOMAIN = "web-production-6e86.up.railway.app";

// --- SCENARIO LOGIC ---

// Handle incoming calls
VoxEngine.addEventListener(AppEvents.CallAlerting, (e) => {
    const call = e.call;
    const callerId = call.callerid();

    call.answer();

    call.addEventListener(CallEvents.Connected, () => {
        Logger.write(`[Scenario] Call connected from ${callerId}`);

        // Optional: Play a short welcome beep or message before connecting to AI
        // call.say("Conectando con Laboratorios Analiza...", Language.Spanish);

        // Start sending media to backend
        const wsURL = `wss://${BACKEND_DOMAIN}/voximplant/realtime?callId=${call.id()}&caller=${callerId}`;
        Logger.write(`[Scenario] Connecting WebSocket to: ${wsURL}`);

        // Open WebSocket to our backend
        const ws = VoxEngine.createWebSocket(wsURL);

        // Bridge Audio
        call.sendMediaTo(ws);       // Mic -> Backend
        ws.sendMediaTo(call);       // Backend -> Speaker

        // WebSocket Events
        ws.addEventListener(WebSocketEvents.Open, () => {
            Logger.write("[Scenario] WebSocket Open");

            // Send 'start' event to backend to trigger OpenAI connection
            const startMsg = JSON.stringify({ event: 'start', callId: call.id() });
            ws.send(startMsg);
        });

        ws.addEventListener(WebSocketEvents.Message, (e) => {
            // Usually we just pipe media, but if we need to handle control messages:
            // const msg = JSON.parse(e.text);
            // Logger.write(`[Scenario] WS Message: ${e.text}`);
        });

        ws.addEventListener(WebSocketEvents.Close, () => {
            Logger.write("[Scenario] WebSocket Closed");
            call.hangup();
        });

        ws.addEventListener(WebSocketEvents.Error, (e) => {
            Logger.write(`[Scenario] WebSocket Error: ${e.text}`);
            call.hangup();
        });

        // Call Events
        call.addEventListener(CallEvents.Disconnected, () => {
            Logger.write("[Scenario] Call Disconnected");
            ws.close();
        });
    });
});
