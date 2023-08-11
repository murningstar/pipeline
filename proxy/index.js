import { createServer } from "http";
import { Server } from "socket.io";
import { Kafka } from "kafkajs";

const kafka = new Kafka({
    clientId: "proxy",
    brokers: ["kafka:9092"],
});
const producer = kafka.producer();
await producer.connect();

const server = createServer();
const io = new Server(server);

io.on("connection", (socket) => {
    console.log("New client connected");

    socket.on("sale", async (data) => {
        console.log(`id${data.storeId} | just sold`);
        await producer.send({
            topic: "sales-topic",
            messages: [
                {
                    key: data.storeId,
                    value: JSON.stringify(data),
                },
            ],
            timeout: 5000,
        });
        // console.dir(data, { depth: null });
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

const PORT = 3773;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
server.on("close", async () => {
    console.log("producer disconnected");
    await producer.disconnect();
});

// /opt/bitnami/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --consumer.config /opt/bitnami/kafka/config/consumer.properties --topic sales-topic --from-beginning
