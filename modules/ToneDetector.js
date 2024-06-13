const FFT = require('fft-js').fft;
const FFTUtils = require('fft-js').util;
const { mean, std } = require('mathjs');
const fs = require('fs');
const path = require("path");
const { exec, spawn } = require('child_process');
const recorder = require('node-record-lpcm16');

const TplinkKasa = require('./TplinkKasa');
const TwilioSmsSender = require('./twilio/TwilioSmsSender');
const Watchdog = require('./Watchdog');
const db = require('../models');
const DiscordWebhook = require("./DiscordWebhook");
const {post} = require("axios");
const {SocketLabsClient} = require("@socketlabs/email");
const Mailer = require("./socketlabs/Mailer");
const TwilioVoiceCall = require("./twilio/TwilioVoiceCall");

class ToneDetector {
    constructor(config, recorderConfig, twilioConfig, socketLabsConfig) {
        this.config = config;
        this.twilioConfig = twilioConfig;
        this.recorderConfig = recorderConfig;
        this.twilioEnabled = twilioConfig && twilioConfig.enabled;
        this.socketLabsEnabled = socketLabsConfig && socketLabsConfig.enabled;
        this.toneIndex = -1;
        this.lastFreq = 0.0;
        this.toneStartTime = null;
        this.freqBuffer = [];
        this.detectedFrequencies = new Array(this.config.numTones).fill(null);
        this.watchdog = new Watchdog(this.config.watchdogTimeout, () => this.resetState());

        if (this.twilioEnabled) {
            this.twilioSmsSender = new TwilioSmsSender(twilioConfig);
            this.twilioVoiceCall = new TwilioVoiceCall(twilioConfig);
        }

        if (this.socketLabsEnabled) {
            this.mailer = new Mailer(socketLabsConfig);
        }
    }

    resetState() {
        this.toneIndex = -1;
        this.lastFreq = 0.0;
        this.toneStartTime = null;
        this.freqBuffer = [];
        this.detectedFrequencies = new Array(this.config.numTones).fill(null);
        //console.log('State reset by watchdog');
    }

    schmittTrigger(data) {
        if (!data || data.length === 0) {
            console.log('No data received or data length is 0');
            return -1;
        }

        const loudness = 20.0 * Math.log10(Math.sqrt(data.reduce((sum, val) => sum + val ** 2, 0) / data.length) / 32768);
        if (loudness < this.config.squelch) {
            if (this.config.debug) {
                console.log(`Signal below squelch level: ${loudness.toFixed(2)} dB`);
            }
            return -1;
        }

        const phasors = FFT(data);
        const magnitudes = FFTUtils.fftMag(phasors);
        const frequencies = FFTUtils.fftFreq(phasors, this.config.sampleRate);
        const maxMagnitude = Math.max(...magnitudes);
        const index = magnitudes.indexOf(maxMagnitude);

        if (index === -1 || frequencies[index] === undefined || frequencies[index] < this.config.minFrequencyThreshold) {
            if (this.config.debug) {
                console.log(`Invalid frequency detected. Max magnitude: ${maxMagnitude}, Index: ${index}, Frequency: ${frequencies[index]}`);
            }
            return -1;
        }

        if (this.config.debug) {
            console.log(`Detected frequency: ${frequencies[index]} Hz, Max magnitude: ${maxMagnitude}`);
        }

        return frequencies[index];
    }

    async processAudioData(data) {
        try {
            const audioData = Array.from(new Int16Array(data.buffer));

            if (!audioData || audioData.length === 0) {
                console.log('No audio data received or data length is 0?');
                return;
            }

            const frequency = this.schmittTrigger(audioData);

            if (!frequency) {
                console.log('No frequency detected?');
                return;
            }

            const currentTime = Date.now();

            if (frequency > 0) {
                if (this.toneStartTime === null) {
                    this.toneStartTime = currentTime;
                }

                const toneDuration = (currentTime - this.toneStartTime) / 1000.0;

                if (toneDuration >= this.config.minToneLength) {
                    this.freqBuffer.push(frequency);
                    const stddev = std(this.freqBuffer);

                    if (stddev < this.config.maxToneFreqStdDeviation) {
                        const meanFreq = mean(this.freqBuffer);

                        if (Math.abs(meanFreq - this.lastFreq) > this.config.minToneFrequencyDifference) {
                            this.toneIndex = (this.toneIndex + 1) % this.config.numTones;
                            this.detectedFrequencies[this.toneIndex] = meanFreq;

                            if (this.toneIndex === this.config.numTones - 1) {
                                console.log('QC2 sequence detected');
                                console.log(`A: ${this.detectedFrequencies[0]} Hz, B: ${this.detectedFrequencies[1]} Hz`);
                                this.watchdog.clear();

                                await this.alertDepartment(this.detectedFrequencies[0], this.detectedFrequencies[1]);
                            } else {
                                this.watchdog.start();
                            }
                            this.lastFreq = meanFreq;
                            this.freqBuffer = [];
                            this.toneStartTime = null;
                        }
                    }
                }
            } else {
                this.resetState();
            }
        } catch (error) {
            console.error('Error processing audio data');
            this.resetState();
        }
    }

    async alertDepartment(toneA, toneB) {
        try {
            const frequencyThreshold = this.config.toneThreshold || 15;

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
                    const url = `${this.twilioConfig.recordingAddress}/recordings/${encodeURIComponent(path.basename(department.name + "_" + now))}.wav`;
                    const filePath = path.join(__dirname, `../recordings/${department.name}_${now}.wav`);

                    console.log(`Alerting department: ${department.name}`);

                    if (department.webhookUrl && this.config.externalWebhookEnable) {
                        try {
                            await post(department.webhookUrl, {
                                message: 'QC2 CALL ALERT',
                                toneA,
                                toneB,
                                department: department.name
                            });
                            console.log(`Notification sent to ${department.webhookUrl}`);
                        } catch (error) {
                            console.error('Error sending notification to external app:', error);
                        }
                    } else {
                        console.log(`Department ${department.name} has no webhook URL set.`);
                    }

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
                                }, this.config.smartTimeOut);
                            }
                        }
                    } catch (error) {
                        console.error('Error activating smart devices:', error);
                    }

                    this.startRecordingAndCallUsers(department, now, filePath);

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
            if (this.twilioEnabled && this.twilioSmsSender) {
                await this.twilioSmsSender.sendSms(user.phoneNumber, this.createAlertMessage(toneAMessage, toneBMessage, department, url));
            }

            if (this.socketLabsEnabled && this.mailer) {
                await this.mailer.send('QC2 Call Alert', this.createAlertMessage(toneAMessage, toneBMessage, department, url), user.email);
            }
        } catch (error) {
            console.error('Error sending user alert:', error);
        }
    }

    createAlertMessage(toneAMessage, toneBMessage, department, url) {
        let urlMsg;

        if (url) {
            urlMsg = `, Recording: ${url}`;
        }

        return `QC2 CALL ALERT: Tone A: ${toneAMessage} Hz, Tone B: ${toneBMessage} Hz, Department: ${department.name}${urlMsg}`;
    }

    async startRecordingAndCallUsers(department, now, filePath) {
        const duration = this.config.recordingDuration * 1000;

        const url = `${department.name}_${now}.wav`;

        if (!this.recorderConfig.recorder) {
            console.error('Recorder configuration is missing.');
            return;
        }

        try {
            const fileStream = fs.createWriteStream(filePath, { encoding: 'binary' });
            const recording = recorder.record({
                sampleRate: this.recorderConfig.sampleRate,
                channels: this.recorderConfig.channels,
                threshold: this.recorderConfig.threshold,
                endOnSilence: this.recorderConfig.endOnSilence,
                silence: this.recorderConfig.silence,
                recorder: this.recorderConfig.recorder,
                device: this.recorderConfig.device,
                audioType: this.recorderConfig.audioType
            });

            const timeout = setTimeout(() => {
                recording.stop();
            }, duration);

            recording.stream().pipe(fileStream);

            recording.stream().on('error', (err) => {
                //console.error('Recorder stream error:', err);
                clearTimeout(timeout);
            });

            fileStream.on('finish', async () => {
                console.log(`Audio recorded successfully: ${filePath}`);
                for (const user of department.Users) {
                    if (this.twilioEnabled && this.twilioVoiceCall) {
                        await this.twilioVoiceCall.makeVoiceCall(user.phoneNumber, ``, url);
                    }
                }
            });

            fileStream.on('error', (err) => {
                console.error('Error writing audio file:', err);
                clearTimeout(timeout);
            });
        } catch (error) {
            console.error('Error recording audio:', error);
        }
    }

    // TODO: Remove after testing
    async testKasa(kasa, deviceIp, flash, backon) {
        const status = await kasa.getDeviceStatus(deviceIp);
        console.log('Device status:', status);

        let interval;

        await kasa.turnDeviceOn(deviceIp);

        if (flash) {
            interval = setInterval(async () => {
                await kasa.turnDeviceOff(deviceIp);
                await new Promise(resolve => setTimeout(resolve, 1000));
                await kasa.turnDeviceOn(deviceIp);
            }, 1000);
        }

        await new Promise(resolve => setTimeout(resolve, 5000));

        clearInterval(interval);

        if (!backon) {
            await kasa.turnDeviceOff(deviceIp);
        } else {
            await kasa.turnDeviceOn(deviceIp);
        }
    }

    stop() {
        this.watchdog.clear();
    }
}

module.exports = ToneDetector;