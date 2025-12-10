import WebSocket from 'ws';
import { FastifyRequest } from 'fastify';
import { OpenAICore } from '../../services/openai/core.js';

export class VoximplantProvider {
    private ws: WebSocket;
    private openaiCore: OpenAICore;
    private callId: string | null = null;
    private isOpenAIConnected = false;

    constructor(connection: any, req: FastifyRequest) {
        this.ws = connection.socket;

        // Extract callId from query or headers if available
        this.callId = (req.query as any).callId || 'unknown-call-id';
        const callerPhone = (req.query as any).caller || '+50300000000';

        console.log(`[VoximplantProvider] New connection. CallId: ${this.callId}, Caller: ${callerPhone}`);

        // Instantiate OpenAI Core with G711 ULAW (standard for telephony)
        this.openaiCore = new OpenAICore({
            audioFormat: 'g711_ulaw',
            callerPhone: callerPhone
        });

        this.setupHandlers();
    }

    private setupHandlers() {
        // Handle audio from OpenAI -> Voximplant
        this.openaiCore.on('audio', (base64Audio: string) => {
            if (this.ws.readyState === WebSocket.OPEN) {
                // Convert Base64 -> Binary Buffer for native Voximplant playback
                const audioBuffer = Buffer.from(base64Audio, 'base64');
                this.ws.send(audioBuffer);
            }
        });

        // Handle text/tools output (optional, mostly for debugging or metadata if needed)
        // this.openaiCore.on('text', ...);

        // Handle messages from Voximplant -> OpenAI
        this.ws.on('message', (data: any, isBinary: boolean) => {
            try {
                if (isBinary) {
                    // Binary = Audio Stream (G711)
                    // Convert Buffer -> Base64 for OpenAI
                    const b64 = (data as Buffer).toString('base64');
                    // Only send if OpenAI is open. If we relied on 'start' event, 
                    // we might potentially drop first milliseconds of audio if start hasn't processed yet.
                    // But 'start' is usually sent immediately.
                    this.openaiCore.sendAudio(b64);
                } else {
                    // Text = Control Messages (JSON)
                    const msg = JSON.parse(data.toString());

                    if (msg.event === 'start') {
                        console.log(`[VoximplantProvider] 'start' event received for ${this.callId}`);
                        if (!this.isOpenAIConnected) {
                            this.openaiCore.connect();
                            this.isOpenAIConnected = true;
                        }
                    } else if (msg.event === 'stop') {
                        console.log(`[VoximplantProvider] 'stop' event received`);
                        this.openaiCore.close();
                    }
                }
            } catch (err) {
                console.error(`[VoximplantProvider] Error processing message:`, err);
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
