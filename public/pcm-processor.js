class PCMProcessor extends AudioWorkletProcessor {
    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        if (input.length > 0) {
            const inputChannel = input[0];

            // Downsample and convert Float32 to Int16
            // We'll just send the raw Float32 to the main thread for resampling/encoding
            // because doing high-quality resampling in the worklet is complex without libraries.
            // Actually, for simplicity in this demo, accessing the buffer here.

            // Post raw float data to main thread
            this.port.postMessage(inputChannel);
        }

        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
