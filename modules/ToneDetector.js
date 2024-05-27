const FFT = require('fft-js').fft;
const FFTUtils = require('fft-js').util;
const { mean, std } = require('mathjs');

const TplinkKasa = require('./TplinkKasa');
const Watchdog = require('./Watchdog');
const db = require('../models');
const DiscordWebhook = require("./DiscordWebhook");
const {post} = require("axios");

class ToneDetector {
    constructor(config) {
        this.config = config;
        this.toneIndex = -1;
        this.lastFreq = 0.0;
        this.toneStartTime = null;
        this.freqBuffer = [];
        this.detectedFrequencies = new Array(this.config.numTones).fill(null);
        this.watchdog = new Watchdog(this.config.watchdogTimeout, () => this.resetState());
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
            //console.log(`Signal below squelch level: ${loudness.toFixed(2)} dB`);
            return -1;
        }

        const phasors = FFT(data);
        const magnitudes = FFTUtils.fftMag(phasors);
        const frequencies = FFTUtils.fftFreq(phasors, this.config.sampleRate);
        const maxMagnitude = Math.max(...magnitudes);
        const index = magnitudes.indexOf(maxMagnitude);

        if (index === -1 || frequencies[index] === undefined || frequencies[index] < this.config.minFrequencyThreshold) {
            //console.log(`Invalid frequency detected. Max magnitude: ${maxMagnitude}, Index: ${index}, Frequency: ${frequencies[index]}`);
            return -1;
        }

        //console.log(`Detected frequency: ${frequencies[index]} Hz, Max magnitude: ${maxMagnitude}`);
        return frequencies[index];
    }

    async processAudioData(data) {
        try {
            const audioData = Array.from(new Int16Array(data.buffer));
            const frequency = this.schmittTrigger(audioData);

            if (!audioData || audioData.length === 0) {
                console.log('No frequency detected or audio data empty?');
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
            console.error('Error processing audio data:', error);
            this.resetState();
        }
    }

    async alertDepartment(toneA, toneB) {
        try {
            const frequencyThreshold = 15; // Hz dang it


            const kasa = new TplinkKasa();

            const departments = await db.Department.findAll({
                include: [
                    { model: db.User },
                    { model: db.SmartDevice, as: 'SmartDevices' }
                ]
            });

            for (const department of departments) {
                if (Math.abs(department.toneA - toneA) <= frequencyThreshold && Math.abs(department.toneB - toneB) <= frequencyThreshold) {
                    console.log(`Alerting department: ${department.name}`);

                    //TODO: Finish this
/*                    if (department.webhookUrl) {
                        await post(department.webhookUrl, {
                            message: 'QC2 CALL ALERT',
                            toneA,
                            toneB,
                            department: department.name
                        });
                        console.log(`Notification sent to ${department.webhookUrl}`);
                    } else {
                        console.log(`Department ${department.name} has no webhook URL set.`);
                    }*/

                    if (department.discordWebhookUrl) {
                        const discordWebhook = new DiscordWebhook(department.discordWebhookUrl);
                        const toneAMessage = toneA.toFixed(1);
                        const toneBMessage = toneB.toFixed(1);
                        await discordWebhook.sendMessage(`QC2 CALL ALERT: Tone A: ${toneAMessage} Hz, Tone B: ${toneBMessage} Hz, Department: ${department.name}`);
                        console.log(`Discord notification sent to ${department.discordWebhookUrl}`);
                    } else {
                        console.log(`Department ${department.name} has no Discord webhook URL set.`);
                    }


                    for (const user of department.Users) {
                        this.sendAlert(user);
                    }

                    for (const device of department.SmartDevices) {
                        if (device.brand === 'KASA') {
                            await kasa.addDeviceByIp(device.ip);
                            await kasa.turnDeviceOn(device.ip);
                        }
                    }

                    break;
                }
            }
        } catch (error) {
            console.error('Error alerting department:', error);
        }
    }

    sendAlert(user) {
        console.log(`Alerting user: ${user.name}, Email: ${user.email}, Phone: ${user.phoneNumber}`);
    }

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
