import { connect } from "@nats-io/transport-node";
import { createCounter } from "./machines";
import { createNatsActor } from "../actors";

const MACHINE_ID = "counter";
const countingMachine = createCounter(MACHINE_ID, 0);

const createTimeoutPromise = (msg: string, ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error(`${msg} timeout after ${ms}ms`)), ms));

async function main() {
  try {
    const nc = await connect({ servers: "nats://localhost:4222" });
    console.log("Connected to NATS");
    console.log(nc.info);

    const actor = createNatsActor(countingMachine, nc);
    
    actor.subscribe((state) => {
      console.log("State changed:", state.value);
      console.log("Context:", state.context);
    });


    console.log("Subscribing to machine messages", `machine.${MACHINE_ID}.>`);
    nc.subscribe(`machine.${MACHINE_ID}.>`);
    console.log("Listening for machine workflow messages");

    actor.start();

    process.on("SIGINT", async () => {
      try {
        console.log("Shutting down...");
        await Promise.all([
          Promise.race([ actor.stop(), createTimeoutPromise("Actor stop", 5000) ]),
          Promise.race([ nc.drain(), createTimeoutPromise("NATS drain", 5000) ])
        ]);
        process.exit(0);
      } catch (err) {
        console.error("Shutdown error:", err);
        process.exit(1);
      }
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main().catch(console.error); 