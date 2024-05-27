const axios = require('axios');

class DiscordWebhook {
    constructor(webhookUrl) {
        if (!webhookUrl) {
            throw new Error('Webhook URL is required');
        }
        this.webhookUrl = webhookUrl;
    }

    async sendMessage(message) {
        if (!message) {
            throw new Error('Message is required');
        }

        try {
            const response = await axios.post(this.webhookUrl, {
                content: message,
            });
            return response.data;
        } catch (error) {
            console.error('Error sending message to Discord webhook:', error);
            throw error;
        }
    }
}

module.exports = DiscordWebhook;