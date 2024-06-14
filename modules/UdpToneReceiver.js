const dgram = require('dgram');
const EventEmitter = require('events');
const crypto = require('crypto');
const path = require('path');
const Opcode = require('../models/Opcode');
const TplinkKasa = require('./TplinkKasa');
const TwilioSmsSender = require('./twilio/TwilioSmsSender');
const db = require('../models');
const DiscordWebhook = require("./DiscordWebhook");
const { post } = require("axios");
const { SocketLabsClient } = require("@socketlabs/email");
const Mailer = require("./socketlabs/Mailer");
const TwilioVoiceCall = require("./twilio/TwilioVoiceCall");

class UdpToneReceiver extends EventEmitter {
    constructor(config, twilioConfig, socketLabsConfig, detectionConfig) {
        super();
        this.config = config;
        this.twilioConfig = twilioConfig;
        this.socketLabsConfig = socketLabsConfig;
        this.detectionConfig = detectionConfig;
        this.socket = dgram.createSocket('udp4');
        this.authenticated = false;
        this.sequenceNumber = 0;

        if (twilioConfig && twilioConfig.enabled) {
            this.twilioSmsSender = new TwilioSmsSender(twilioConfig);
            this.twilioVoiceCall = new TwilioVoiceCall(twilioConfig);
        }

        if (socketLabsConfig && socketLabsConfig.enabled) {
            this.mailer = new Mailer(socketLabsConfig);
        }
    }

    start() {
        this.socket.on('message', (msg, rinfo) => {
            const message = JSON.parse(msg.toString());
            this.processMessage(message, rinfo);
        });

        this.socket.bind(() => {
            console.log(`UDP client bound, attempting to connect to server at ${this.config.address}:${this.config.port}`);
            this.authenticate();
        });
    }

    stop() {
        this.socket.close();
    }

    authenticate() {
        const hash = crypto.createHash('sha256').update(this.config.authToken).digest('hex');
        const authMessage = JSON.stringify({
            opcode: Opcode.AUTH,
            nodeId: this.config.nodeId,
            hash: hash
        });
        this.socket.send(authMessage, 0, authMessage.length, this.config.port, this.config.address);
    }

    processMessage(message, rinfo) {
        switch (message.opcode) {
            case Opcode.AUTH_OK:
                this.authenticated = true;
                console.log('Authenticated successfully');
                this.startPing();
                break;
            case Opcode.AUTH_FAIL:
                console.log('Authentication failed');
                break;
            case Opcode.AUTH_DUPE_NODE:
                console.log('Duplicate node ID');
                break;
            case Opcode.PONG:
                console.log(`Received PONG for sequence: ${message.sequenceNumber}`);
                break;
            case Opcode.TONE_REPORT:
                if (this.authenticated) {
                    console.log(`Received tone report: A=${message.frequencyA} Hz, B=${message.frequencyB} Hz`);
                    this.alertDepartment(message.frequencyA, message.frequencyB);
                }
                break;
            default:
                console.log(`Unknown opcode: ${message.opcode}`);
                break;
        }
    }

    startPing() {
        setInterval(() => {
            const pingMessage = JSON.stringify({
                opcode: Opcode.PING,
                sequenceNumber: this.sequenceNumber
            });
            this.socket.send(pingMessage, 0, pingMessage.length, this.config.port, this.config.address);
            console.log(`Sent PING with sequence: ${this.sequenceNumber}`);
            this.sequenceNumber += 1;
        }, 5000);
    }

    async alertDepartment(toneA, toneB) {
        try {
            const frequencyThreshold = this.detectionConfig.toneThreshold || 15;

            const kasa = new TplinkKasa();

            const departments = await db.Department.findAll({
                include: [
                    { model: db.User },
                    { model: db.SmartDevice, as: 'SmartDevices' }
                ]
            });

            for (const department of departments) {
                if (Math.abs(department.toneA - toneA) <= frequencyThreshold && Math.abs(department.toneB - toneB) <= frequencyThreshold) {
                    const now = Date.now();
                    const url = `${this.detectionConfig.recordingAddress}/recordings/${encodeURIComponent(path.basename(department.name + "_" + now))}.wav`;
                    const filePath = path.join(__dirname, `../recordings/${department.name}_${now}.wav`);

                    console.log(`Alerting department: ${department.name}`);

                    if (department.discordWebhookUrl) {
                        try {
                            const discordWebhook = new DiscordWebhook(department.discordWebhookUrl);
                            const toneAMessage = toneA.toFixed(1);
                            const toneBMessage = toneB.toFixed(1);
                            await discordWebhook.sendMessage(this.createAlertMessage(toneAMessage, toneBMessage, department, url));
                            console.log(`Discord notification sent to ${department.discordWebhookUrl}`);
                        } catch (error) {
                            console.error('Error sending Discord notification:', error);
                        }
                    } else {
                        console.log(`Department ${department.name} has no Discord webhook URL set.`);
                    }

                    for (const user of department.Users) {
                        await this.sendAlert(user, toneA.toFixed(1), toneB.toFixed(1), department, url);
                    }

                    try {
                        for (const device of department.SmartDevices) {
                            if (device.brand === 'KASA') {
                                await kasa.addDeviceByIp(device.ip);
                                await kasa.turnDeviceOn(device.ip);

                                setTimeout(async () => {
                                    await kasa.turnDeviceOff(device.ip);
                                }, this.detectionConfig.smartTimeOut);
                            }
                        }
                    } catch (error) {
                        console.error('Error activating smart devices:', error);
                    }

                    break;
                }
            }
        } catch (error) {
            console.error('Error alerting department:', error);
        }
    }

    async sendAlert(user, toneAMessage, toneBMessage, department, url) {
        try {
            console.log(`Alerting user: ${user.name}, Email: ${user.email}, Phone: ${user.phoneNumber}`);
            if (this.twilioConfig && this.twilioSmsSender) {
                await this.twilioSmsSender.sendSms(user.phoneNumber, this.createAlertMessage(toneAMessage, toneBMessage, department, url));
            }

            if (this.socketLabsConfig && this.mailer) {
                await this.mailer.send('QC2 Call Alert', this.createAlertMessage(toneAMessage, toneBMessage, department, url), user.email);
            }
        } catch (error) {
            console.error('Error sending user alert:', error);
        }
    }

    createAlertMessage(toneAMessage, toneBMessage, department, url) {
        let urlMsg = '';

        if (url) {
            urlMsg = `, Recording: ${url}`;
        }

        return `QC2 CALL ALERT: Tone A: ${toneAMessage} Hz, Tone B: ${toneBMessage} Hz, Department: ${department.name}${urlMsg}`;
    }
}

module.exports = UdpToneReceiver;