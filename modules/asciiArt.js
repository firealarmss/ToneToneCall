function asciiArt(config) {
    const art = `
    
    .%%%%%%...%%%%...%%..%%..%%%%%%..........%%%%%%...%%%%...%%..%%..%%%%%%...........%%%%....%%%%...%%......%%.....
    ...%%....%%..%%..%%%.%%..%%................%%....%%..%%..%%%.%%..%%..............%%..%%..%%..%%..%%......%%.....
    ...%%....%%..%%..%%.%%%..%%%%..............%%....%%..%%..%%.%%%..%%%%............%%......%%%%%%..%%......%%.....
    ...%%....%%..%%..%%..%%..%%................%%....%%..%%..%%..%%..%%..............%%..%%..%%..%%..%%......%%.....
    ...%%.....%%%%...%%..%%..%%%%%%............%%.....%%%%...%%..%%..%%%%%%...........%%%%...%%..%%..%%%%%%..%%%%%%.
    ................................................................................................................         
    `;

    console.log(art);

    if (config.webUI && config.webUI.enabled) {
        console.log("WebUI:");
        console.log(`   Port: ${config.webUI.port}`);
        console.log(`   Address: ${config.webUI.address}`);
    } else {
        console.log("WebUI: Disabled");
    }

    if (config.twilio && config.twilio.enabled) {
        console.log("Twilio:");
        console.log(`   Account SID: ${config.twilio.accountSid}`);
        console.log(`   Auth Token: ${config.twilio.authToken}`);
        console.log(`   From Number: ${config.twilio.fromNumber}`);
        console.log(`   Recording URL: ${config.twilio.recordingAddress}`);
    } else {
        console.log("Twilio: Disabled");
    }

    if (config.mailer) {
        console.log("Mailer:");
        console.log(`   From Email: ${config.mailer.fromEmail}`);
        if (config.mailer.socketLabs && config.mailer.socketLabs.enabled) {
            console.log("   SocketLabs:");
            console.log(`      Server ID: ${config.mailer.socketLabs.serverId}`);
            console.log(`      API Key: ${config.mailer.socketLabs.injectionApi}`);
        } else {
            console.log("   SocketLabs: Disabled");
        }
    } else {
        console.log("Mailer: Disabled");
    }
}

module.exports = { asciiArt };