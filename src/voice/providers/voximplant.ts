import WebSocket from "ws";
import { FastifyRequest } from "fastify";
import { OpenAICore } from "../../services/openai/core.js";

export class VoximplantProvider {
    private ws: WebSocket;
    private openai: OpenAICore;
    private callId: string;
    private callerPhone: string;
    private openAIReady = false;

    constructor(connection: any, req: FastifyRequest) {
        this.ws = connection.socket;
        this.callId = (req.query as any).callId || "unknown-call";
        this.callerPhone = (req.query as any).caller || "unknown";

        console.log(
            `[VoximplantProvider] WS Connected | callId=${this.callId} | caller=${this.callerPhone}`
        );

        this.openai = new OpenAICore({
            callerPhone: this.callerPhone,
            audioFormat: "pcm16",  // CORRECT FOR VOXIMPLANT
        });

        this.setupHandlers();
    }

    private setupHandlers() {
        // ---- OPENAI → VOXIMPLANT (IA habla al paciente) ----
        this.openai.on("audio", (base64Audio: string) => {
            if (this.ws.readyState !== WebSocket.OPEN) return;

            // Convert Base64 → Binary buffer for Voximplant
            const buffer = Buffer.from(base64Audio, "base64");

            try {
                this.ws.send(buffer, { binary: true });
            } catch (err) {
                console.error("[VoximplantProvider] Error sending audio:", err);
            }
        });

        // When OpenAI Realtime is ready
        this.openai.on("ready", () => {
            this.openAIReady = true;
            console.log("[VoximplantProvider] OpenAI session is ready.");
        });

        // ---- VOXIMPLANT → OPENAI (Audio del cliente) ----
        this.ws.on("message", (data: any, isBinary: boolean) => {
            if (isBinary) {
                // PCM → base64 for OpenAI
                const b64 = Buffer.from(data).toString("base64");

                if (this.openAIReady) {
                    this.openai.sendAudio(b64);
                }

                return;
            }

            // ---- CONTROL MESSAGES ----
            try {
                const msg = JSON.parse(data.toString());

                if (msg.event === "start") {
                    console.log("[VoximplantProvider] Received START event");
                    this.openai.connect(); // Begin Realtime session
                }

                if (msg.event === "stop") {
                    console.log("[VoximplantProvider] Received STOP event");
                    this.openai.close();
                }
            } catch (err) {
                console.error("[VoximplantProvider] Error parsing JSON:", err);
            }
        });

        // ---- CALL / WS CLOSE ----
        this.ws.on("close", () => {
            console.log(
                `[VoximplantProvider] WS closed | callId=${this.callId}`
            );
            this.openai.close();
        });

        this.ws.on("error", (err) => {
            console.error("[VoximplantProvider] WebSocket error:", err);
            this.openai.close();
        });
    }
}
