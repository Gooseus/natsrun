import type { NatsConnection, Subscription, MsgHdrs } from "@nats-io/nats-core";
import type { ConsumerConfig, ConsumerMessages, JetStreamClient, JsMsg, Stream, StreamConfig, StreamInfo, OrderedConsumerOptions } from "@nats-io/jetstream";
import type { Handler } from "natsrun";
import * as assert from "node:assert";

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { connect, headers as createNatsHeaders, headers } from "@nats-io/transport-node";
import { jetstream, jetstreamManager } from "@nats-io/jetstream";
import { NatsRun } from "natsrun";
import { WebSocket, WebSocketServer } from "ws";
import { compile } from 'angular-expressions';
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "url";

type TTemplatSegment = string | ((data: any) => string);
type TTemplateArray = Array<TTemplatSegment>;
type TTemplateMap = Record<string, TTemplateArray>;

const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), "templates");
const EXPR_REGEX = /{{([^\}]+)}}/g
/**
 * Parses a template string and returns an array of segments.
 * Each segment is either a literal string or a function that accepts a data object
 * and returns a string. The function uses angular-expressions to compile and evaluate
 * expressions found within the delimiters.
 *
 * @param template - The template string to parse.
 * @param delimiterRegex - A global RegExp that matches the delimiters. The first capturing group should capture the expression.
 * @returns An array containing literal string segments and evaluator functions.
 */
function parseTemplate(
  template: string,
  delimiterRegex: RegExp = EXPR_REGEX
): TTemplateArray {
  const segments: TTemplateArray = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Ensure the regex is global.
  const regex = new RegExp(delimiterRegex.source, delimiterRegex.flags.includes('g') ? delimiterRegex.flags : delimiterRegex.flags + 'g');

  while ((match = regex.exec(template)) !== null) {
    // Push any literal text before the current match.
    if (match.index > lastIndex) {
      segments.push(template.slice(lastIndex, match.index));
    }
    
    // Extract the expression from the first capturing group.
    const expression = match[1];
    
    // Compile the expression using angular-expressions.
    const compiledFn = compile(expression);
    
    // Create a function that evaluates the compiled expression using provided data.
    segments.push((data: any) => {
      try {
        const evaluated = compiledFn(data);
        // Convert undefined or null results to an empty string.
        return evaluated == null ? '' : evaluated.toString();
      } catch (error) {
        console.error(`Error evaluating expression "${expression}":`, error);
        return '';
      }
    });
    
    lastIndex = regex.lastIndex;
  }

  // Append any remaining literal text after the last match.
  if (lastIndex < template.length) {
    segments.push(template.slice(lastIndex));
  }

  return segments;
}

const templateFilter = (file: string) => file.endsWith(".html") || file.endsWith(".htmx");
const templateEngine = (obj: TTemplateMap, template: string) => {
  obj[template] = parseTemplate(readFileSync(join(TEMPLATE_DIR, template), "utf-8"));
  return obj;
};

console.log(TEMPLATE_DIR);
const templateLookup: TTemplateMap = readdirSync(TEMPLATE_DIR).filter(templateFilter).reduce(templateEngine, {});

/**
 * Creates a NATS subject from an HTTP request
 * @param req - The incoming HTTP request
 * @param prefix - The prefix to use for the subject
 * @returns The formatted NATS subject
 */
const createSubject = (req: IncomingMessage, prefix: string) => {
  let topic = req.url?.slice(1);
  topic = topic?.length === 0 ? "index" : topic;
  return `${prefix}.${req.method?.toLowerCase()}.${topic?.replace(/\//g, ".")}`;
};

/**
 * Tests the createSubject function
 */
async function test() {
  assert.strictEqual(createSubject({ method: "GET", url: "/users" } as IncomingMessage, "test"), "test.get.users");
}

/**
 * NATSRun router class that handles message routing between HTTP, WebSocket, and NATS
 * Provides methods for stream management and message handling
 */
class NatsRouter {
  private paused = false;

  /**
   * Creates a new NATSRun router
   * @param nc - NATS connection instance
   * @param headers - Array of header keys to track
   */
  constructor(private nc: NatsConnection, private headers: string[], private nr = new NatsRun()) {}

  /**
   * Adds a route handler for a specific topic
   * @param topic - The NATS subject to handle
   * @param handler - The handler function for the topic
   */
  async route(topic: string, handler: Handler) {
    await this.nr.add(topic, handler);
  }

  /**
   * Listens for messages on a subscription and routes them through NATSRun
   * @param subject - The subscription or consumer messages to listen to
   */
  async listen(subject: Subscription | ConsumerMessages) {
    const headers: Record<string, string> = {};

    for await (const msg of subject) {
      if (msg.headers) {
        for (const key of this.headers) {
          if (this.paused) {
            break;
          }
          if (msg.headers.has(key)) {
            headers[key] = msg.headers.get(key);
          }
        }
      }
      this.nr.handle(msg.subject, msg.data, headers);
      if ('ack' in msg && typeof msg.ack === 'function') {
        msg.ack();
      }
    }
  }

  /**
   * Pauses message processing
   */
  async pause() {
    this.paused = true;
  }

  /**
   * Resumes message processing
   */
  async unpause() {
    this.paused = false;
  }

  /**
   * Closes the NATS connection
   */
  async close() {
    await this.nc.close();
  }

  /**
   * Cleanup method for the router
   */
  destructor() {
    this.close();
  }

  /**
   * Creates a JetStream stream if it doesn't exist
   * @param name - The name of the stream
   * @param subjects - Array of subjects to subscribe to
   * @param config - Additional stream configuration
   * @returns The created or existing stream
   */
  async createStream(name: string, subjects: string[], config: Partial<StreamConfig> = {}): Promise<Stream> {
    const manager = await jetstreamManager(this.nc);
    try {
      const stream = await manager.streams.get(name);
      if (stream) {
        console.log(`Stream ${name} already exists`);
        return stream;
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'StreamNotFoundError') throw err; 
    }

    await manager.streams.add({ name, subjects, ...config });
    return manager.streams.get(name);
  }

  /**
   * Creates a JetStream consumer if it doesn't exist
   * @param stream - The stream name
   * @param config - Consumer configuration
   * @returns The created or existing consumer
   */
  async createConsumer(stream: string, config: Partial<ConsumerConfig> = {}) {
    const js = await jetstream(this.nc);
    const manager = await jetstreamManager(this.nc);
    console.log("Creating consumer", stream, config);
    let consumer;
    try {
      consumer = await js.consumers.get(stream, config.name);
      if (consumer) {
        console.log(`Consumer ${config.name} already exists`);
        return consumer;
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'ConsumerNotFoundError') throw err; 
    }
    if (!consumer) {
      await manager.consumers.add(stream, { ...config, ack_policy: "explicit" });
      consumer = await js.consumers.get(stream, config.name);
    }
    console.log(`Created consumer: ${config.name} (stream: ${stream}, subject: ${config.filter_subjects})`);
    return consumer;
  }

  /**
   * Publishes a message to a JetStream stream
   * @param stream - The stream name
   * @param subject - The subject to publish to
   * @param data - The message data
   * @param headers - Optional message headers
   * @returns The acknowledgment from the stream
   */
  async publishToStream(stream: string, subject: string, data: Uint8Array, headers?: Record<string, string>) {
    const natsHeaders = createNatsHeaders();
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        natsHeaders.set(key, value);
      });
    }
    const ack = await jetstream(this.nc).publish(stream, data, { headers: natsHeaders });
    console.log(`Published to stream ${stream}: ${subject} (seq: ${ack.seq})`);
    return ack;
  }

  /**
   * Listens for messages from a JetStream stream
   * @param stream - The stream name
   * @param name - The consumer name
   */
  async listenToStream(stream: string, name: string) {
    const consumer = await jetstream(this.nc).consumers.get(stream, name);
    const sub = await consumer.consume();

    return this.listen(sub);
  }
}


const buildTemplate = async (template: string, data: any): Promise<string> => {
  const segments = await templateLookup[`${template}.html`];
  return segments.map((segment) => {
    if (typeof segment === "function") {
      return segment(data);
    }
    if (typeof segment === "string") {  
      return segment;
    }
    console.warn(`Unknown template segment type: ${typeof segment}`);
    return "";
  }).join("");
};


/**
 * Middleware that publishes HTTP requests to NATS subjects
 * @param nc - NATS connection instance
 * @param opts - Middleware options including prefix
 * @returns Middleware function
 */
const publishNats = (nc: NatsConnection, opts: { prefix: string }) => {
  return async (req: IncomingMessage, res: ServerResponse) => {
    // Serve HTML for root path
    // check for client id in cookies
    let clientId = req.headers.cookie
      ?.split("; ")
      .find((row) => row.startsWith("clientId="))
      ?.split("=")[1];
    if (!clientId) {
      clientId = "client-" + Math.random().toString(36).substring(2, 15);
      res.setHeader("Set-Cookie", `clientId=${clientId}`);
    }

    if (req.method === "GET") {
      const roomId = req.url?.split("/").pop();
      if (!roomId) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`Enter a roomId: <input type="text" id="roomId" /> <button onclick="window.location.href='/' + document.getElementById('roomId')?.value;">Join</button>`);
        return;
      }

      try {
        const html = await buildTemplate("chat", { roomId, clientId });
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
      } catch (error) {
        console.error("Error processing template:", error);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
      return;
    }

    const subject = createSubject(req, opts.prefix);
    const headers = createNatsHeaders();
    const rawBody = (await req.toArray()) as unknown as Buffer;
    let contentType = req.headers["content-type"];

    headers.set("Content-Type", contentType ?? "application/octet-stream");
    headers.set("Reply-To", `${clientId}.push`);
    headers.set("Client-Id", clientId);

    console.log("Publishing message:", subject, rawBody.toString("hex"), headers);
    await nc.publish(subject, rawBody.toString("hex"), { headers });
    res.end("OK");
  };
};

/**
 * Main application entry point
 * Sets up HTTP server, WebSocket server, and NATS routing
 */
async function main() {
  const name = "http-nats-demo";

  const nc = await connect({ servers: "nats://localhost:4222", name });
  const router = new NatsRouter(nc, ["Content-Type", "Reply-To", "Client-Id"]);

  console.log("Connected to NATS");

  // Create a JetStream stream for user events
  await router.createStream("users", [`${name}.>`], {
    retention: "workqueue",
    storage: "memory"
  });

  await router.createConsumer("users", { name: "get_users", filter_subjects: [`${name}.get.users`] });
  await router.createConsumer("users", { name: "post_users", filter_subjects: [`${name}.post.users`] });

  // Add NATS routes
  await router.route(`${name}.get.users`, async (msg) => {
    console.log("Received GET /users request:", msg.subject, msg.headers);
    if (msg?.headers?.["Reply-To"]) {
      await nc.publish(`${name}.${msg.headers["Reply-To"]}.push`, 
        `Nice GET ~ from NATS Server Client #${msg.headers["Client-Id"]}`);
    }
  });

  await router.route(`${name}.post.users`, async (msg) => {
    console.log("Received POST /users request:", msg.subject, msg.data, msg.headers);
    
    // Publish to JetStream stream
    await router.publishToStream("users", `${name}.user.created`, msg.data, msg.headers);
    
    if (msg?.headers?.["Reply-To"]) {
      await nc.publish(`${name}.${msg.headers["Reply-To"]}`, 
        `Nice POST ~ from NATS Server Client #${msg.headers["Client-Id"]}`);
    }
  });

  // Subscribe to user events from the stream
  const server = createServer({ keepAliveTimeout: 60000 }, publishNats(nc, { prefix: name }));
  router.listenToStream("users", "get_users");
  router.listenToStream("users", "post_users");


  // WEBSOCKET SERVER
  const wss = new WebSocketServer({ server });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    console.log("New WebSocket connection", req.url);

    // Need to get a client id and use it to subscribe to the client id
    const [roomId, clientId] = req.url?.split("/").slice(-2) ?? [];
    const subscription: Subscription = nc.subscribe(`${name}.${roomId}.${clientId}.>`);
    console.log("Subscribed to", `${name}.${roomId}.${clientId}.>`);

    for await (const msg of subscription) {
      console.log("Received message:", msg.subject, msg.data, msg.headers);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg.data.toString());
      }
    }

    ws.on("close", () => {
      console.log("Client disconnected", clientId);
      subscription.unsubscribe();
    });
  });

  // Start the server
  const port = 3000;
  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log("Try these endpoints:");
    console.log("  GET  http://localhost:3000/users");
    console.log("  POST http://localhost:3000/users");
    console.log("\nJetStream Stream:");
    console.log("  Stream: users");
    console.log("  Subjects: " + `${name}.user.*`);

    const subscription: Subscription = nc.subscribe(`${name}.>`);
    await router.listen(subscription);
  });

  // Modify shutdown handler to clean up WebSocket server
  process.on("SIGINT", async () => {
    wss.close();
    await nc.close();
    process.exit(0);
  });
}

await test();

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
