import WebSocket from 'ws';
import { FastifyRequest } from 'fastify';
import { OpenAICore } from '../../services/openai/core.js';

export class ChatProvider {
    private ws: WebSocket;
    private openaiCore: OpenAICore;
    private callId: string | null = null;

    constructor(connection: any, req: FastifyRequest) {
        this.ws = connection.socket;

        // Browser client ID or session ID
        this.callId = `web-${Date.now()}`;
        const callerPhone = 'WEB-CLIENT';

        console.log(`[ChatProvider] New connection. CallId: ${this.callId}, Caller: ${callerPhone}`);

        // Instantiate OpenAI Core
        this.openaiCore = new OpenAICore({
            audioFormat: 'pcm16', // Browser mic sends pcm16 (after our conversion in voice.html)
            callerPhone: callerPhone
        });

        this.setupHandlers();

        // For browser, we might want to trigger connection immediately or wait for first message
        // Here we trigger it because the user clicks "Start Call"
        this.openaiCore.connect();
    }

    private setupHandlers() {
        // Handle audio from OpenAI -> Browser
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

        // Handle text from OpenAI -> Browser
        this.openaiCore.on('text', (textDelta: string) => {
            if (this.ws.readyState === WebSocket.OPEN) {
                const message = {
                    event: 'text',
                    text: textDelta
                };
                this.ws.send(JSON.stringify(message));
            }
        });

        // Handle messages from Browser -> OpenAI
        this.ws.on('message', (data: any) => {
            try {
                const msg = JSON.parse(data.toString());

                if (msg.event === 'media') {
                    // Send audio payload to OpenAI
                    if (msg.media && msg.media.payload) {
                        this.openaiCore.sendAudio(msg.media.payload);
                    }
                } else if (msg.event === 'text') {
                    // Send text payload to OpenAI
                    if (msg.text) {
                        this.openaiCore.sendText(msg.text);
                    }
                }
                // We could add 'stop' or 'start' events here if needed
            } catch (err) {
                console.error(`[ChatProvider] Error parsing message:`, err);
            }
        });

        this.ws.on('close', () => {
            console.log(`[ChatProvider] Connection closed for ${this.callId}`);
            this.openaiCore.close();
        });


        // Handle OpenAI errors
        this.openaiCore.on('error', (err: any) => {
            console.error(`[ChatProvider] OpenAI Core Error:`, err);
            if (this.ws.readyState === WebSocket.OPEN) {
                // Send specific error if API KEY is likely cause (401)
                if (err.message && err.message.includes('401')) {
                    this.ws.close(4001, "Backend: OpenAI API Key Invalid");
                } else {
                    this.ws.close(1011, "Backend: OpenAI Connection Error");
                }
            }
        });

        this.ws.on('error', (err) => {
            console.error(`[ChatProvider] WebSocket error:`, err);
            this.openaiCore.close();
        });
    }
}
