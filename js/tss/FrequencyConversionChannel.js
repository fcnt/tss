/**
 * T'SoundSystem for JavaScript
 */

/**
 * FrequencyConversionChannel prototype
 *
 * This prototype implements frequency conversion channel.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
function FrequencyConversionChannel () {
    this.type = FrequencyConversionChannel.TYPE_NO_CONVERSION;
    this.inFrequency = 44100;
    this.outFrequency = 44100;
    this.inBuffer = null;
    this.outBuffer = null;
    this.bufferLength = 0;
    this.channel = null;
    this.converter = null;
    this.filter = null;
}

FrequencyConversionChannel.TYPE_NO_CONVERSION = 0;
FrequencyConversionChannel.TYPE_UPPER_SAMPLING = 1;
FrequencyConversionChannel.TYPE_DOWN_SAMPLING = 2;

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
FrequencyConversionChannel.prototype.setBufferLength = function (length) {
    this.outBuffer = new Int32Array(length);
    this.bufferLength = length;
    this._reconstruct();
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
FrequencyConversionChannel.prototype.getBuffer = function () {
    return this.outBuffer;
};

/**
 * Set processing channel.
 * @param channel channel to process
 */
FrequencyConversionChannel.prototype.setChannel = function (channel) {
    this.channel = channel;
    this._reconstruct();
};

/**
 * Set input frequency.
 * @param frequency input frequency
 */
FrequencyConversionChannel.prototype.setInputFrequency = function (frequency) {
    this.inFrequency = frequency;
    this._reconstruct();
}
 
/**
 * Set output frequency.
 * @param frequency output frequency
 */
FrequencyConversionChannel.prototype.setOutputFrequency = function (frequency) {
    this.outFrequency = frequency;
    this._reconstruct();
}

/**
 * Generate specified length sound stream into internal buffer.
 * @see MasterChannel
 * @param length sound length in short to generate
 */
FrequencyConversionChannel.prototype.generate = function (length) {
    if (this.outBuffer === null)
        return;
    var i;
    if (this.channel === null || this.inBuffer == null) {
        for (i = 0; i < length; ++i)
            this.outBuffer[i] = 0;
        return;
    }
    
    if (this.type == FrequencyConversionChannel.TYPE_NO_CONVERSION) {
        this.channel.generate(length);
        for (i = 0; i < length; ++i)
            this.outBuffer[i] = this.inBuffer[i];
    } else if (this.type == FrequencyConversionChannel.TYPE_UPPER_SAMPLING) {
        this.filter.generate(length);
        for (i = 0; i < length; ++i)
            this.outBuffer[i] = this.inBuffer[i];
    }
};

/**
 * Reconstruct internal processing chains.
 */
FrequencyConversionChannel.prototype._reconstruct = function () {
    if (this.inFrequency == this.outFrequency) {
        // output <= input channel
        this.type = FrequencyConversionChannel.TYPE_NO_CONVERSION;
        this.converter = null;
        this.filter = null;
        if (this.channel && this.bufferLength !== 0) {
            this.channel.setBufferLength(this.bufferLength);
            this.inBuffer = this.channel.getBuffer();
        } else {
            this.inBuffer = null;
        }
    } else if (this.inFrequency < this.outFrequency) {
        // output <= interpolation filter <= convertion <= input channel
        this.type = FrequencyConversionChannel.TYPE_UPPER_SAMPLING;
        this.filter = new BiquadFilterChannel();
        this.filter.setParameter(BiquadFilterChannel.TYPE_LPF,
                                 this.inFrequency / 2 * 0.95, 0.95, 20);
        this.converter = new FrequencyConversionChannel.ConversionChannel();
        this.converter.setInputFrequency(this.inFrequency);
        this.converter.setOutputFrequency(this.outFrequency);
        this.filter.setChannel(this.converter);
        if (this.bufferLength !== 0) {
            this.filter.setBufferLength(this.bufferLength);
            this.inBuffer = this.filter.getBuffer();
        } else {
            this.inBuffer = null;
        }
        if (this.channel !== null)
            this.converter.setChannel(this.channel);
    } else {
        // output <= convertion <= dicimation filter <= input channel
        this.type = FrequencyConversionChannel.TYPE_DOWN_SAMPLING;
        this.converter = null;
        this.filter = null;
        this.inBuffer = null;
        Log.getLog().warn('FrequencyConversionChannel: ' +
                'down sampling is not supported yet.');
    }
}

/**
 * ConversionChannel prototype
 *
 * This prototype implements upper conversion channel.
 * @author Takashi Toyoshima <toyoshim@gmail.com>
 */
FrequencyConversionChannel.ConversionChannel = function () {
    this.count = 0;
    this.inFrequency = 44100;
    this.outFrequency = 44100;
    this.inBuffer = null;
    this.outBuffer = null;
    this.bufferLength = 0;
    this.channel = null;
    this.inOffset = 0;
};

/**
 * @see MasterChannel
 * @param length buffer length or size in shorts
 */
FrequencyConversionChannel.ConversionChannel.prototype.setBufferLength =
        function (length) {
    this.outBuffer = new Int32Array(length);
    this.bufferLength = length;
    if (null !== this.channel) {
        this.channel.setBufferLength(length);
        this.inBuffer = this.channel.getBuffer();
    }
};

/**
 * @see MasterChannel
 * @return audio stream buffer
 */
FrequencyConversionChannel.ConversionChannel.prototype.getBuffer = function () {
    return this.outBuffer;
};

/**
 * Set processing channel.
 * @param channel channel to process
 */
FrequencyConversionChannel.ConversionChannel.prototype.setChannel =
        function (channel) {
    if ((0 !== this.bufferLength) && (null !== channel)) {
        channel.setBufferLength(this.bufferLength);
        this.inBuffer = channel.getBuffer();
    }
    this.channel = channel;
};

/**
 * Set input frequency.
 * @param frequency input frequency
 */
FrequencyConversionChannel.ConversionChannel.prototype.setInputFrequency =
        function (frequency) {
    this.inFrequency = frequency;
}
 
/**
 * Set output frequency.
 * @param frequency output frequency
 */
FrequencyConversionChannel.ConversionChannel.prototype.setOutputFrequency =
        function (frequency) {
    this.outFrequency = frequency;
}

/**
 * Generate specified length sound stream into internal buffer.
 * @see MasterChannel
 * @param length sound length in short to generate
 */
FrequencyConversionChannel.ConversionChannel.prototype.generate =
        function (length) {
    var i;
    if (null === this.channel) {
        for (i = 0; i < length; ++i)
            this.outBuffer[i] = 0;
        return;
    }

    if (this.inFrequency == this.outFrequency) {
        // No conversion.
        this.channel.generate(length);
        for (i = 0; i < length; ++i)
            this.outBuffer[i] = this.inBuffer[i];
    } else if (this.inFrequency < this.outFrequency) {
        // Upper sampling.
        for (i = 0; i < length; i += 2) {
            if (this.count >= 0) {
                if (this.inOffset === 0)
                    this.channel.generate(length);
                this.outBuffer[i + 0] = this.inBuffer[this.inOffset + 0];
                this.outBuffer[i + 1] = this.inBuffer[this.inOffset + 1];
                this.inOffset += 2;
                if (this.inOffset == this.bufferLength)
                    this.inOffset = 0;
                this.count -= this.outFrequency;
            } else {
                this.outBuffer[i + 0] = 0;
                this.outBuffer[i + 1] = 0;
            }
            this.count += this.inFrequency;
        }
    } else {
        // Down sampling.
        // TODO(toyoshim): Implement.
        for (i = 0; i < length; ++i)
            this.outBuffer[i] = 0;
    }
};
