const recorder = require('node-record-lpcm16');
const { Command } = require('commander');

const db = require('./models');
const bcrypt = require('bcryptjs');
const ToneDetector = require('./modules/ToneDetector');
const loadConfig = require('./modules/configLoader');
const app = require('./modules/server/Server');

const program = new Command();

program
    .option('-c, --config <path>', 'set config path', './config.yml')
    .option('-p, --port <port>', 'set port', 3000)
    .parse(process.argv);

program.parse(process.argv);

const options = program.opts();

const configPath = options.config || './config.yml';
const port = options.port;

const config = loadConfig(configPath);

const toneDetector = new ToneDetector(config.toneDetection);

const recording = recorder.record({
    sampleRate: config.recording.sampleRate,
    channels: config.recording.channels,
    threshold: config.recording.threshold,
    endOnSilence: config.recording.endOnSilence,
    silence: config.recording.silence,
    recorder: config.recording.recorder,
    device: config.recording.device,
    audioType: config.recording.audioType
});

console.log(config.recording.device);

recording.stream()
    .on('data', (data) => {
        toneDetector.processAudioData(data);
    })
    .on('error', (err) => {
        console.error('recorder threw an error:', err);
        toneDetector.resetState();
    });

process.on('exit', () => {
    recording.stop();
    toneDetector.stop();
});

console.log('Listening for audio...');

async function createDefaultAdminUser() {
    const userCount = await db.User.count();
    if (userCount === 0) {
        await db.User.create({
            name: 'Admin',
            email: 'admin@example.com',
            phoneNumber: '+00000000000',
            password: "password",
            role: 'admin'
        });
        console.log('Default admin user created with email: admin@example.com and password: password');
    }
}

db.sequelize.sync().then(async () => {
    await createDefaultAdminUser();
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}).catch(err => {
    console.error('Unable to connect to the database:', err);
});
