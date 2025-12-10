import WebSocket from 'ws';
import { FastifyRequest } from 'fastify';
import { OpenAICore } from '../../services/openai/core.js';

export class VoximplantProvider {
    private ws: WebSocket;
    private openaiCore: OpenAICore;
    private callId: string | null = null;

    constructor(connection: any, req: FastifyRequest) {
        this.ws = connection.socket;

        // Extract callId from query or headers if available
        this.callId = (req.query as any).callId || 'unknown-call-id';
        const callerPhone = (req.query as any).caller || '+50300000000'; // Fallback or pass from Voximplant

        console.log(`[VoximplantProvider] New connection. CallId: ${this.callId}, Caller: ${callerPhone}`);

        // Instantiate OpenAI Core
        this.openaiCore = new OpenAICore({
            audioFormat: 'pcm16', // OpenAI Realtime supports pcm16 natively
            callerPhone: callerPhone
        });

        this.setupHandlers();
    }

    private setupHandlers() {
        // Handle audio from OpenAI -> Voximplant
        this.openaiCore.on('audio', (audioDelta: string) => {
            if (this.ws.readyState === WebSocket.OPEN) {
                const message = {
                    event: 'media',
                    media: {
                        payload: audioDelta
                    }
                };
                this.ws.send(JSON.stringify(message));
            }
        });

        // Handle messages from Voximplant -> OpenAI
        this.ws.on('message', (data: any) => {
            try {
                const msg = JSON.parse(data.toString());

                if (msg.event === 'start') {
                    console.log(`[VoximplantProvider] Stream started for ${this.callId}`);
                    // Connect to OpenAI when stream starts
                    this.openaiCore.connect();
                } else if (msg.event === 'media') {
                    // Send audio payload to OpenAI
                    if (msg.media && msg.media.payload) {
                        this.openaiCore.sendAudio(msg.media.payload);
                    }
                } else if (msg.event === 'stop') {
                    console.log(`[VoximplantProvider] Stream stopped for ${this.callId}`);
                    this.openaiCore.close();
                }
            } catch (err) {
                console.error(`[VoximplantProvider] Error parsing message:`, err);
            }
        });

        this.ws.on('close', () => {
            console.log(`[VoximplantProvider] Connection closed for ${this.callId}`);
            this.openaiCore.close();
        });

        this.ws.on('error', (err) => {
            console.error(`[VoximplantProvider] WebSocket error:`, err);
            this.openaiCore.close();
        });
    }
}
