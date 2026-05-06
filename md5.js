class MD5 {
        static _rotl(x, n) {
            return (x << n) | (x >>> (32 - n));
        }
        static _add(x, y) {
            return (x + y) & 0xFFFFFFFF;
        }
        static _F(x, y, z) { return (x & y) | (~x & z); }
        static _G(x, y, z) { return (x & z) | (y & ~z); }
        static _H(x, y, z) { return x ^ y ^ z; }
        static _I(x, y, z) { return y ^ (x | ~z); }
        constructor(dataChunk = null) {
            this._state = [
                0x67452301,
                0xefcdab89,
                0x98badcfe,
                0x10325476
            ];
            this._buffer = new Uint8Array(64);
            this._bufferLength = 0;
            this._totalLength = 0n;
            this._finalized = false;
            if (dataChunk != null) {
                this.update(dataChunk);
            }
        }
        _transform(block) {
            let a = this._state[0];
            let b = this._state[1];
            let c = this._state[2];
            let d = this._state[3];
            const M = new Uint32Array(16);
            for (let i = 0; i < 16; i++) {
                const j = i * 4;
                M[i] = (block[j]) | (block[j + 1] << 8) | (block[j + 2] << 16) | (block[j + 3] << 24);
            }
            for (let i = 0; i < 64; i++) {
                let f, g, round;
                if (i < 16) {
                    f = MD5._F(b, c, d);
                    g = i;
                    round = 0;
                }
                else if (i < 32) {
                    f = MD5._G(b, c, d);
                    g = (5 * i + 1) % 16;
                    round = 1;
                }
                else if (i < 48) {
                    f = MD5._H(b, c, d);
                    g = (3 * i + 5) % 16;
                    round = 2;
                }
                else {
                    f = MD5._I(b, c, d);
                    g = (7 * i) % 16;
                    round = 3;
                }
                const shift = MD5.S[round][i % 4];
                const k_i = MD5.K[i];
                let temp_sum = MD5._add(a, f);
                temp_sum = MD5._add(temp_sum, k_i);
                temp_sum = MD5._add(temp_sum, M[g]);
                const temp_d = d;
                d = c;
                c = b;
                b = MD5._add(b, MD5._rotl(temp_sum, shift));
                a = temp_d;
            }
            this._state[0] = MD5._add(this._state[0], a);
            this._state[1] = MD5._add(this._state[1], b);
            this._state[2] = MD5._add(this._state[2], c);
            this._state[3] = MD5._add(this._state[3], d);
        }
        update(dataChunk) {
            if (!(dataChunk instanceof Uint8Array)) {
                throw new TypeError('Expects a Uint8Array as input.');
            }
            if (this._finalized) {
                throw new Error('MD5: Cannot update after finalizing. Create a new instance for a new hash.');
            }
            const dataLen = dataChunk.length;
            this._totalLength += BigInt(dataLen) * 8n;
            let offset = 0;
            if (this._bufferLength > 0) {
                const spaceLeft = 64 - this._bufferLength;
                const toCopy = Math.min(dataLen, spaceLeft);
                this._buffer.set(dataChunk.subarray(0, toCopy), this._bufferLength);
                this._bufferLength += toCopy;
                offset += toCopy;
                if (this._bufferLength === 64) {
                    this._transform(this._buffer);
                    this._bufferLength = 0;
                }
            }
            while (offset + 64 <= dataLen) {
                this._transform(dataChunk.subarray(offset, offset + 64));
                offset += 64;
            }
            if (offset < dataLen) {
                const remaining = dataLen - offset;
                this._buffer.set(dataChunk.subarray(offset), 0);
                this._bufferLength = remaining;
            }
        }
        _finalize() {
            if (this._finalized) {
                return;
            }
            this._buffer[this._bufferLength++] = 0x80;
            if (this._bufferLength === 64) {
                this._transform(this._buffer);
                this._bufferLength = 0;
            }
            while (this._bufferLength % 64 !== 56) {
                this._buffer[this._bufferLength++] = 0;
                if (this._bufferLength === 64) {
                    this._transform(this._buffer);
                    this._bufferLength = 0;
                }
            }
            const L = this._totalLength;
            this._buffer[56] = Number(L & 0xffn);
            this._buffer[57] = Number((L >> 8n) & 0xffn);
            this._buffer[58] = Number((L >> 16n) & 0xffn);
            this._buffer[59] = Number((L >> 24n) & 0xffn);
            const L_high = L >> 32n;
            this._buffer[60] = Number(L_high & 0xffn);
            this._buffer[61] = Number((L_high >> 8n) & 0xffn);
            this._buffer[62] = Number((L_high >> 16n) & 0xffn);
            this._buffer[63] = Number((L_high >> 24n) & 0xffn);
            this._transform(this._buffer);
            this._finalized = true;
        }
        digest() {
            this._finalize();
            const hashBytes = new Uint8Array(16);
            for (let i = 0; i < 4; i++) {
                const val = this._state[i];
                hashBytes[i * 4 + 0] = (val & 0xFF);
                hashBytes[i * 4 + 1] = ((val >>> 8) & 0xFF);
                hashBytes[i * 4 + 2] = ((val >>> 16) & 0xFF);
                hashBytes[i * 4 + 3] = ((val >>> 24) & 0xFF);
            }
            return hashBytes;
        }
        hexdigest() {
            const hashBytes = this.digest();
            return Array.from(hashBytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }
    }
    MD5.S = [
        [7, 12, 17, 22],
        [5, 9, 14, 20],
        [4, 11, 16, 23],
        [6, 10, 15, 21]
    ];
    MD5.K = (() => {
        const k = [];
        for (let i = 0; i < 64; i++) {
            k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * (2 ** 32));
        }
        return k;
    })();