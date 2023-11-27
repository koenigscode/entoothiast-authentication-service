import * as mqtt from "mqtt"
import MqttRequest from "mqtt-request"
import PGClient from "pg-native"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const db = new PGClient()
db.connectSync(process.env.CONNECTION_STRING)
const PW_SALT_ROUNDS = process.env.PW_SALT_ROUNDS || 10
const JWT_SECRET = process.env.JWT_SECRET || "very secret secret"

const client = mqtt.connect(process.env.BROKER_URL)
/** @type {MqttRequest}*/
const mqttReq = new MqttRequest.default(client);

console.log(`Broker URL: ${process.env.BROKER_URL}`)


mqttReq.response("v1/users/register", (payload) => {
    const { username, password, name, role } = JSON.parse(payload)
    const passwordHash = bcrypt.hashSync(password, PW_SALT_ROUNDS)
    try {
        db.querySync("insert into public.user (username, pw_hash, name, role) values ($1, $2, $3, $4)", [username, passwordHash, name, role])
        return JSON.stringify({ error: true, message: "Registered user" })
    } catch (e) {
        console.log(e)
        return JSON.stringify({ error: true, message: "Username already exists" })
    }
});

mqttReq.response("v1/users/authentication", (payload) => {
    const { username, password } = JSON.parse(payload)
    const users = db.querySync("select username, name, pw_hash, role from public.user where username = $1", [username])
    if (!users || users.length == 0)
        return JSON.stringify({ error: true, message: "User not found" })

    if (bcrypt.compareSync(password, users[0].pw_hash)) {
        const user = users[0]
        const token = jwt.sign({ username: user.username, role: user.role, name: user.name }, JWT_SECRET)
        return JSON.stringify({ error: false, message: "Authentication successful", token })
    }

    return JSON.stringify({ error: true, message: "Authentication failed" })
})



client.on("connect", async () => {
    mqttReq.request("v1/users/register",
        (payload) => {
            console.log("Get response:" + payload.toString());
        },
        JSON.stringify({ username: "test", password: "test", name: "Name", role: "patient" })
    )
    mqttReq.request("v1/users/authentication",
        (payload) => {
            console.log("Get response:" + payload.toString());
            console.log(jwt.decode(JSON.parse(payload).token))
        },
        JSON.stringify({ username: "test", password: "test" })
    )

    console.log("authentication-service connected to broker")
});
