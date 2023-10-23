const E1600API = require("ankersolixe1600");
require('dotenv').config();
const MQTT = require("mqtt");
const express = require('express');
const fs = require("fs");
let siteInstance = null;
let siteHomepage = null;

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

const restService = async function() {
    const app = express();
    var cors = require('cors');
    const bodyParser = require('body-parser');
    app.use(bodyParser.json());
    app.use(cors())
    app.use('/', express.static('public'));
    app.all('/setEnergy/:side_id?',restSetEnergy);
    app.all('/getHomepage',restGetHomepage);

    app.listen(process.env.HTTP_PORT);
    console.log("HTTP/REST Service Listening on http://localhost:"+process.env.HTTP_PORT);
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
    /*
    const mqtt = MQTT.connect("mqtt://127.0.0.1:1883");
    const app = Express();
    const port = 3000;
    */
   return;
}

service();
