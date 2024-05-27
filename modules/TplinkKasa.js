const { Client } = require('tplink-smarthome-api');

class TplinkKasa {
    constructor() {
        this.client = new Client();
        this.devices = new Map();
    }

    async addDeviceByIp(ip) {
        try {
            const device = await this.client.getDevice({ host: ip });
            this.devices.set(ip, device);
            console.log(`Added device: ${device.alias} (${ip})`);
        } catch (error) {
            console.error(`Failed to add device at ${ip}:`, error.message);
        }
    }

    async getDeviceStatus(ip) {
        const device = this.devices.get(ip);
        if (!device) {
            throw new Error('Device not found');
        }

        const status = await device.getSysInfo();
        return status;
    }

    async turnDeviceOn(ip) {
        const device = this.devices.get(ip);
        if (!device) {
            throw new Error('Device not found');
        }

        await device.setPowerState(true);
        console.log(`Turned on device: ${device.alias}`);
    }

    async turnDeviceOff(ip) {
        const device = this.devices.get(ip);
        if (!device) {
            throw new Error('Device not found');
        }

        await device.setPowerState(false);
        console.log(`Turned off device: ${device.alias}`);
    }
}

module.exports = TplinkKasa;
