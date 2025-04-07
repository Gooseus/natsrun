import type { IPFActor } from "./machines";
import type { Subscription } from "@nats-io/nats-core";
import { createReadStream, readFileSync } from 'fs';
import { connect } from "@nats-io/transport-node";
import { createNatsActor } from "../actors/index.ts";
import { createIPFWorker } from "./machines/index.ts";

const createTimeoutPromise = (msg: string, ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error(`${msg} timeout after ${ms}ms`)), ms));

async function* generateObservations(stream: NodeJS.ReadableStream) {
  let buffer = '';
  
  for await (const chunk of stream) {
    buffer += chunk;
    if(!buffer.includes('\n')) continue;
    const lines = buffer.split('\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (line) {
        yield line.split('\t');
      }
    }
    
    buffer = lines[lines.length - 1];
  }

  if (buffer.trim()) {
    yield buffer.trim().split('\t');
  }
}

async function main() {
  try {
    const nc = await connect({ servers: "nats://localhost:4222" });
    const meta = JSON.parse(readFileSync('./data/crash.meta.json', 'utf8'));
    const dataStream = createReadStream('./data/crash.data.csv', 'utf8');

    console.log('records', meta.n);
    for (const [key, value] of Object.entries(meta.vc)) {
      console.log(key, value);
    }
    

    const ipfMachine = createIPFWorker('ipf');
    const actor: IPFActor = createNatsActor(ipfMachine, nc);

    (async (sub: Subscription) => {
      for await (const msg of sub) {
        console.log('msg', msg.subject, JSON.parse(msg.data.toString()));
        break;
      }
      console.log('done.');
      sub.unsubscribe();
      process.emit('SIGINT');
    })(nc.subscribe('machine.ipf.complete'));

    actor.start();
    actor.send({ type: 'START', metadata: meta });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    for await (const observation of generateObservations(dataStream)) {
      actor.send({ type: 'DATA', observation });
    }

    actor.send({ type: 'COMPLETE' });

    process.on("SIGINT", async () => {
      console.log('shutting down.');
      try {
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