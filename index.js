import * as mqtt from "mqtt"
import MqttRequest from "mqtt-request"
import PGClient from "pg-native"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

MqttRequest.timeout = 5000;

const db = new PGClient()
db.connectSync(process.env.CONNECTION_STRING)
const PW_SALT_ROUNDS = process.env.PW_SALT_ROUNDS || 10
const JWT_SECRET = process.env.JWT_SECRET || "very secret secret"

const client = mqtt.connect(process.env.BROKER_URL)
/** @type {MqttRequest}*/
export const mqttReq = new MqttRequest.default(client);

console.log(`Broker URL: ${process.env.BROKER_URL}`)


mqttReq.response("v1/users/register", (payload) => {
    payload = JSON.parse(payload)

    if (!payload.username || !payload.password || !payload.name || !payload.role)
        return JSON.stringify({ httpStatus: 400, message: "username, password, name and role must be set" })

    const passwordHash = bcrypt.hashSync(payload.password, PW_SALT_ROUNDS)

    try {
        db.querySync("insert into public.user (username, pw_hash, name, role) values ($1, $2, $3, $4)", [payload.username, passwordHash, payload.name, payload.role])
        return JSON.stringify({ httpStatus: 201, message: `Registered user ${payload.username}` })
    } catch (e) {
        return JSON.stringify({ httpStatus: 400, message: `Username ${payload.username} already exists` })
    }
});

mqttReq.response("v1/users/login", (payload) => {
    payload = JSON.parse(payload)

    if (!payload.username || !payload.password)
        return JSON.stringify({ httpStatus: 400, message: "username and password must be set" })

    const users = db.querySync("select username, id, name, pw_hash, role from public.user where username = $1", [payload.username])

    if (!users || users.length == 0)
        return JSON.stringify({ httpStatus: 404, message: "User not found" })

    if (bcrypt.compareSync(payload.password, users[0].pw_hash)) {
        let user = users[0]
        user = { username: user.username, role: user.role, name: user.name, id: user.id}
        const token = jwt.sign(user, JWT_SECRET)
        return JSON.stringify({ httpStatus: 200, user, message: "Authentication successful", token })
    }

    return JSON.stringify({ httpStatus: 400, message: "Wrong password" })
})



client.on("connect", async () => {
    console.log("authentication-service connected to broker")
});
