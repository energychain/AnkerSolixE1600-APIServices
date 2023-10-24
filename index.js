const E1600API = require("ankersolixe1600");
require('dotenv').config();
const MQTT = require("mqtt");
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const fs = require("fs");
let siteInstance = null;
let siteHomepage = null;


const { spawn } = require('child_process');

const restartScript = function(req,res) {
  console.log('Restarting the service...');
  res.status(503).json({err:"Service Restarting"});     
  server.close(() => {
    const node = process.argv[0];
  const script = process.argv[1];
  const args = process.argv.slice(2);
  
  const child = spawn(node, [script, ...args], {
    stdio: 'inherit' // Share the stdin/out/err with the parent process
  });

  child.on('exit', (code, signal) => {
    console.log(`Child process exited with code ${code} and signal ${signal}`);
  });
  });
}


const createSession = async function(resetSession) {
    if( 
        ((typeof resetSession !== 'undefined')&&(resetSession==false)) ||
        (fs.existsSync("./session.json"))
    )          
    {
        try {
            const options = JSON.parse(fs.readFileSync("./session.json"));
            siteInstance = new E1600API(options);
            siteHomepage = await siteInstance.getSitehomepage();
        } catch(e) {
            try {
                fs.unlink("./session.json");
            } catch(e2) {

            }
            await createSession(true);
            console.log("Fallback to Username/Password Login");
        }
    }
    else
    {
        const options = {
            username: process.env.ANKER_USERNAME,
            password: process.env.ANKER_PASSWORD,
            country: process.env.ANKER_COUNTRY
        }
        try {
            siteInstance = new E1600API(options);
            siteHomepage = await siteInstance.getSitehomepage();
            fs.writeFileSync("./session.json", JSON.stringify(siteInstance.getSessionConfiguration()));
        } catch(e) {
            throw new Error("Unable to create session");
        }
    }
    return;
}

/**
 * REST API Endpoint to sets the energy for a specific site.
 *
 * @param {Object} req - the request object containing the site ID, power, and other parameters
 * @param {Object} res - the response object to send back to the client
 * @return {void}
 */
const restSetEnergy = async function(req,res) {
    let site_id = 0; // use site_id 0 as Default
    let power = 200; // setPower to default 200W
    if(typeof req.params.site_id !== 'undefined') site_id = req.params.site_id;
    if(typeof req.query.site_id !== 'undefined') side_id = req.query.site_id;
    if(typeof req.query.power !== 'undefined') power = req.query.power;
    if(typeof req.body.power !== 'undefined') power = req.body.power;
    power = power * 1 ; //typecast
    let turn_on = true;
    if(power < 150) turn_on = false; else {
        power = 50 * (Math.round(power/50));
    }
    try {
        const schedule =  {
            "ranges": [
                {
                    "id": 0,
                    "start_time": "00:00",
                    "end_time": "24:00",
                    "turn_on": turn_on,
                    "appliance_loads": [
                        {
                            "id": 0,
                            "name": "Generic Load",
                            "power": power,
                            "number": 1
                        }
                    ]
                }
            ],
            "min_load": 150,
            "max_load": 800,
            "step": 50
        };
        let r = await siteInstance.setSchedule(schedule,site_id);
        res.status(200).json(r);           
    } catch(e) {
        res.status(500).json({
            error: {
                message: e.message // Send the error message in the response
            }
        });
        console.error('/setEnergy',e);
    }
    return;
}

/**
 * Retrieves the schedule for a specific site.
 *
 * @param {Object} req - the request object
 * @param {Object} res - the response object
 * @return {void} 
 */
const restGetSchedule = async function(req,res) {
    let site_id = 0; // use site_id 0 as Default
    if(typeof req.params.site_id !== 'undefined') site_id = req.params.site_id;
    if(typeof req.query.site_id !== 'undefined') side_id = req.query.site_id;
    try {
        let r = await siteInstance.getSchedule(site_id);
        res.status(200).json(r);           
    } catch(e) {
        res.status(500).json({
            error: {
                message: e.message // Send the error message in the response
            }
        });
        console.error('/getSchedule',e);
    }
    return;
}

/**
 * Sets the schedule for a specific site.
 *
 * @param {Object} req - the request object
 * @param {Object} res - the response object
 * @return {Promise} a Promise that resolves with the response data
 */
const restSetSchedule = async function(req,res) {
    let site_id = 0; // use site_id 0 as Default
    if(typeof req.params.site_id !== 'undefined') site_id = req.params.site_id;
    if(typeof req.query.site_id !== 'undefined') side_id = req.query.site_id;
    try {
        let r = await siteInstance.setSchedule(req.body,site_id);
        res.status(200).json(r);         
    } catch(e) {
        res.status(500).json({
            error: {
                message: e.message // Send the error message in the response
            }
        });
        console.error('/setSchedule',e);
    }    
}


/**
 * Handle the GET request for the homepage.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @return {Promise} The promise that resolves to the response object.
 */
const restGetHomepage = async function(req,res) {
    try {
    siteHomepage = await siteInstance.getSitehomepage();
    res.status(200).json(siteHomepage); 
    } catch(e) {
        res.status(500).json({
            error: {
                message: e.message // Send the error message in the response
            }
        });
        console.error('/getHomepage',e);
    }    
};

/**
 * Authenticates the user with Anker Cloud Credentials and retrieves the site homepage.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @return {Object} The site homepage JSON.
 */
const restLogin = async function(req,res) {
    let credentials = {
        username: req.body.ANKER_USERNAME,
        password: req.body.ANKER_PASSWORD,
        country: req.body.ANKER_COUNTRY
    }
    try {
        siteInstance = new E1600API(credentials);
        siteHomepage = await siteInstance.getSitehomepage();
        fs.writeFileSync("./session.json", JSON.stringify(siteInstance.getSessionConfiguration()));
        res.status(200).json(siteHomepage);
    } catch(e) {
        res.status(500).json({
            error: {
                message: e.message // Send the error message in the response
            }
        });
        console.error('/setLogin',e);
    }
}
/**
 * Initializes and starts the HTTP/REST service.
 *
 * @return {Promise<void>} A promise that resolves when the service is started.
 */
const restService = async function() {
    var cors = require('cors');
    const bodyParser = require('body-parser');
    app.use(bodyParser.json());
    app.use(cors())
    app.use('/', express.static('public'));
    app.all('/setEnergy/:side_id?',restSetEnergy);
    app.get('/schedule/:side_id?',restGetSchedule);
    app.post('/schedule/:side_id?',restSetSchedule);
    app.all('/getHomepage',restGetHomepage);
    app.all('/restart',restartScript);
    app.post('/login',restLogin);

    //app.listen(process.env.HTTP_PORT);
    server.listen(process.env.HTTP_PORT);
    console.log("HTTP/REST Service Listening on http://localhost:"+process.env.HTTP_PORT);
    return;
}


const mqttService = async function() {
    const mqtt = require('mqtt');
    try {
         const connection = mqtt.connect(process.env.MQTT_URL);

        connection.on('connect', function () {
            console.log("Connected to MQTT: "+process.env.MQTT_URL);
            if(typeof process.env.MQTT_TOPIC_ROOT !== 'undefined') {
                connection.subscribe(process.env.MQTT_TOPIC_ROOT+"/energy",function() {});
                const publisherStatus = async function() {
                    try {
                        const status = await siteInstance.getSitehomepage();
                        connection.publish(process.env.MQTT_TOPIC_ROOT + '/homepage', JSON.stringify(status),{retain:true});
                        for(let i=0;i<status.solarbank_list.length;i++) {
                            for (const [key, value] of Object.entries(status.solarbank_list[i])) {
                                connection.publish(process.env.MQTT_TOPIC_ROOT + '/solarbank/'+i+'/'+key, value,{retain:true});
                            }
                        }
                    } catch(e) {
                        console.log("Error publishing MQTT",e);
                    }
                };
                setInterval(publisherStatus,60000);
                publisherStatus();
                console.log("Publishing "+process.env.MQTT_TOPIC_ROOT);
                connection.on('message', async (topic, payload) => {
                    try {
                        console.log('setEnergy',payload);
                        let site_id = 0;
                        let power = payload * 1; // setPower to default 200W
                        if(typeof req.params.site_id !== 'undefined') site_id = req.params.site_id;
                        if(typeof req.query.site_id !== 'undefined') side_id = req.query.site_id;
                        if(typeof req.query.power !== 'undefined') power = req.query.power;
                        if(typeof req.body.power !== 'undefined') power = req.body.power;
                        power = power * 1 ; //typecast
                        let turn_on = true;
                        if(power < 150) turn_on = false; else {
                            power = 50 * (Math.round(power/50));
                        }

                        const schedule =  {
                            "ranges": [
                                {
                                    "id": 0,
                                    "start_time": "00:00",
                                    "end_time": "24:00",
                                    "turn_on": turn_on,
                                    "appliance_loads": [
                                        {
                                            "id": 0,
                                            "name": "Generic Load",
                                            "power": power,
                                            "number": 1
                                        }
                                    ]
                                }
                            ],
                            "min_load": 150,
                            "max_load": 800,
                            "step": 50
                        };
                        await siteInstance.setSchedule(schedule,site_id);
                    } catch(e) {
                        console.log("Error processing MQTT message",e);
                    }
                    return;
                });

            }           
        })
    } catch(e) {
        console.log("Unable to connect to MQTT. Will Retry in 20 seconds");
        console.debug(e);
        setTimeout(mqttService, 20000);
    }
    return;
}

const service = async function() {
    const _createSession = async function() {
        try {
            await createSession(false);
        } catch(e) {
            console.log("Unable to create session to Anker Cloud. Will Retry in 20 seconds");
            console.debug(e);
            setTimeout(_createSession, 20000);
        }
        return;
    }
    await _createSession();

    if(typeof process.env.HTTP_PORT !== 'undefined') {
        restService();
    }
  
    if(typeof process.env.MQTT_URL !== 'undefined') {
        mqttService();
    }
   return;
}

service();
