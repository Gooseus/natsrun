import type { NatsConnection, Subscription } from "@nats-io/nats-core";
import { NatsRun } from "natsrun";
import { createActor } from "xstate";

/**
 * Creates an XState actor that subscribes to NATS messages and publishes final state updates NATS topics
 * @param machine - The XState machine to create an actor for
 * @param nc - The NATS connection to use
 * @returns The created actor
 */
export const createNatsActor = (machine: any, nc: NatsConnection) => {
  const actor = createActor(machine);
  const router = new NatsRun();
  const observer = {
    error(error: any) {
      nc.publish(`machine.${machine.id}.error`, JSON.stringify(error));
    },
    complete() {
      nc.publish(`machine.${machine.id}.complete`, JSON.stringify(actor.getSnapshot().context));
    }
  };

  for (const event of actor.logic.events) {
    router.add(`machine.${machine.id}.${event.toLowerCase()}`, async () => actor.send({ type: event }));
  }

  actor.subscribe(observer);

  (async (sub: Subscription, stop: () => boolean) => {
    for await (const msg of sub) {
      try {
        await router.handle(msg.subject, msg.data);
      } catch (error) {
        nc.publish(`machine.${machine.id}.error`, JSON.stringify(error));
      }
      if (stop()) break;
    }
  })(nc.subscribe(`machine.${machine.id}.>`), () => actor.getSnapshot().matches('complete'));


  return actor;
};
