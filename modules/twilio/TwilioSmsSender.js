class TwilioSmsSender {
    constructor(config) {
        this.config = config;

        this.twilio = require('twilio');
        this.client = undefined;

        this.initialize();
    }

    initialize() {
        this.client = this.twilio(this.config.accountSid, this.config.authToken);
    }

    async sendSms(to, message) {
        if (!this.client) {
            console.log('Twilio sms sender client not initialized');
        }

        try {
            await this.client.messages.create({
                body: message,
                from: this.config.fromNumber,
                to: to
            });
        } catch (e) {
            console.log(e);
        }
    }
}

module.exports = TwilioSmsSender;