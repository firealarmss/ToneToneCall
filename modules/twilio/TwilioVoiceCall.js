const path = require("path");

class TwilioVoiceCall {
    constructor(config) {
        this.config = config;

        this.initialize();
    }

    initialize() {
        console.log('Initializing Twilio Outbound Voice Call');

        this.client = require('twilio')(this.config.accountSid, this.config.authToken);
    }

    async makeVoiceCall(to, message, audioFilePath) {
        if (!this.client) {
            console.log('Twilio client not initialized');
            return;
        }

        const audioUrl = `${this.config.recordingAddress}/recordings/${encodeURIComponent(path.basename(audioFilePath))}`;

        //console.log(`Making voice call to ${to} with message: ${message} and audio file: ${audioUrl}`);

        try {
            const twiml = `<Response><Say>${message}</Say><Play>${audioUrl}</Play></Response>`;
            this.client.calls
                .create({
                    twiml: twiml,
                    to: to,
                    from: this.config.fromNumber
                })
                .then(call => {
                    //console.log(`Call SID: ${call.sid}`);
                });
        } catch (e) {
            console.log(e);
        }
    }
}

module.exports = TwilioVoiceCall;
