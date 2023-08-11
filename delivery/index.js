import { createServer } from "http";
import { Server } from "socket.io";
import { Kafka } from "kafkajs";
import { createClient } from "redis";

const topicTPS = "total-per-store";
const topicHRPS = "highest-receipt-per-store";
const server = createServer();
const ioServer = new Server(server, {
    cors: { origin: "*" },
});
const redisClient = createClient({
    socket: {
        host: "redis-stack",
        port: "6379",
    },
});

ioServer.on("connection", async (socket) => {
    console.log("New web-client connected");
    const [maxCached, totalCached] = await Promise.all([
        redisClient.HGETALL(topicHRPS),
        redisClient.HGETALL(topicTPS),
    ]);
    socket.emit("maxCached", maxCached);
    socket.emit("totalCached", totalCached);

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

const kafka = new Kafka({
    clientId: "delivery",
    brokers: ["kafka:9092"],
});
const consumer = kafka.consumer({ groupId: "delivery" });
await consumer.connect();
await consumer.subscribe({ topics: [topicTPS, topicHRPS] });
await redisClient.connect();
consumer.run({
    eachMessage: async ({ topic, partition, message, heartbeat, pause }) => {
        if (topic == topicTPS) {
            redisClient.HSET(
                topicTPS,
                message.key.toString(),
                message.value.toString()
            );
            ioServer.emit("totalUpdate", {
                storeId: message.key.toString(),
                value: message.value.toString(),
            });
        }
        if (topic == topicHRPS) {
            redisClient.HSET(
                topicHRPS,
                message.key.toString(),
                message.value.toString()
            );
            ioServer.emit("maxUpdate", {
                storeId: message.key.toString(),
                value: message.value.toString(),
            });
        }
        console.log({
            key: message.key.toString(),
            value: message.value.toString(),
            headers: message.headers,
        });
    },
});
const PORT = 7337;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
server.on("close", async () => {
    console.log("producer disconnected");
    await producer.disconnect();
    await redisClient.disconnect();
});

// /opt/bitnami/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --consumer.config /opt/bitnami/kafka/config/consumer.properties --topic sales-topic --from-beginning
