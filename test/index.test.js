import chai from "chai";
import * as mqtt from "mqtt"
import MqttRequest from "mqtt-request"
import { assert } from "chai";

const client = mqtt.connect(process.env.BROKER_URL)
/** @type {MqttRequest}*/
const mqttReq = new MqttRequest.default(client);

describe ('Register user', function (){
    it("should register the user", (done) => {
        mqttReq.request("v1/users/register",
        (payload) => {
            payload = JSON.parse(payload);
            assert.isString(payload.username);
            done();
        },
        JSON.stringify({ username: "test", password: "test", name: "Name", role: "patient" })
    )
    })


})


after(()=>{
    console.log("hi");
    client.end();
    console.log("hi");
})