const {SocketLabsClient} = require('@socketlabs/email');

class Mailer {
    constructor(config) {
        this.config = config;

        if (!this.config.enabled) {
            console.log("No mailer configuration found");
            return;
        }

        if (this.config.enabled) {
            this.emailClient = new SocketLabsClient(parseInt(this.config.serverId), this.config.injectionApi);
        }
    }

    async send(subject, body, email){
        let message;

        message = {
            to: email,
            from: this.config.fromEmail,
            subject: subject,
            textBody: body,
            htmlBody: body,
            messageType: 'basic'
        }

        this.emailClient.send(message);

        console.log(`Send email ${subject} and body ${body} to ${email}`);
    }
}

module.exports = Mailer;