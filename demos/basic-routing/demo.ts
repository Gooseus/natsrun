import { connect } from "@nats-io/transport-node";
import { NatsRun } from "natsrun";

const NatsRunHeaders = ["X-Custom-Header", "X-Custom-Header-2", "X-Custom-Header-3"];

const decode = (data: Uint8Array) => {
  return new TextDecoder().decode(data);
}

async function main() {
  // Connect to NATS
  try {
    const nc = await connect({ servers: "nats://localhost:4222" });
    console.log("Connected to NATS");
    console.log(nc.getServer());

    // Create a router
    const router = new NatsRun();

    // Define routes
    router.add("greet.*", async ({ subject }) => {
      const name = subject.split(".")[1];
      console.log(`Hello, ${name}!`);
    });

    router.add("echo.*", async ({ data }) => {
      console.log(decode(data));
    });

    // Start the router
    const sub = nc.subscribe(">");

    for await (const msg of sub) {
      let headers: Record<string, string> = {};
      for (const key of NatsRunHeaders) {
          const value = msg.headers?.get(key);
          if (value) headers[key] = value;
      }
      router.handle(msg.subject, msg.data, headers);
    }

    console.log("Router started");
    console.log("Listening for messages on greet.* and echo.*");

    // Keep the process running
    process.on("SIGINT", async () => {
      await nc.close();
      process.exit(0);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main().catch(console.error);
