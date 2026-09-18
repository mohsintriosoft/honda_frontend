// pcm-processor.js
// AudioWorkletProcessor that queues raw PCM16 mono chunks (as sent by
// consumers.py's VoiceChatConsumer, BOT_AUDIO_SAMPLE_RATE = 24000) and
// plays them back in order.
//
// Messages accepted on port:
//   ArrayBuffer            → queue this PCM16 chunk
//   {type: "clear"}        → barge-in: drop everything queued right now
//   {type: "end"}          → server is done sending; once the queue
//                             actually drains, post {type:"ended"} back
//
// This "ended" message (not the server's pcm_end) is what the page uses
// as the true "finished playing" signal — see initWorklet()'s
// port.onmessage in the route file.

class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._queue = [];
        this._readOffset = 0;
        this._ended = false;
        this._notifiedEnded = false;

        this.port.onmessage = (event) => {
            const msg = event.data;
            if (msg instanceof ArrayBuffer) {
                this._queue.push(new Int16Array(msg));
                this._ended = false;
                this._notifiedEnded = false;
                return;
            }
            if (msg && msg.type === "clear") {
                this._queue = [];
                this._readOffset = 0;
                this._ended = false;
                this._notifiedEnded = false;
                return;
            }
            if (msg && msg.type === "end") {
                this._ended = true;
            }
        };
    }

    process(_inputs, outputs) {
        const output = outputs[0][0];
        if (!output) return true;

        for (let i = 0; i < output.length; i++) {
            if (this._queue.length === 0) {
                output[i] = 0;
                continue;
            }
            const chunk = this._queue[0];
            output[i] = chunk[this._readOffset] / 0x8000;
            this._readOffset++;
            if (this._readOffset >= chunk.length) {
                this._queue.shift();
                this._readOffset = 0;
            }
        }

        if (this._ended && this._queue.length === 0 && !this._notifiedEnded) {
            this._notifiedEnded = true;
            this.port.postMessage({ type: "ended" });
        }

        return true;
    }
}

registerProcessor("pcm-processor", PCMProcessor);