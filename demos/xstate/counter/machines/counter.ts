import { createMachine, assign } from "xstate";

type CounterEvent = 
  | { type: "START" }
  | { type: "COUNT" }
  | { type: "COMPLETE" }
  | { type: "FINISH" }
  | { type: "ERROR" }
  | { type: "RETRY" };

interface CounterContext {
  count: number;
  lastMessage: string;
}

export const createCounter = (id: string, start = 0) => createMachine({
  id,
  initial: "idle",
  context: {
    count: start,
    lastMessage: "",
  },
  states: {
    idle: {
      on: {
        START: { target: "processing" },
      },
    },
    processing: {
      on: {
        COUNT: {
          target: "processing",
          actions: assign({
            count: ({ context }) => context.count + 1,
            lastMessage: ({ event }) => event.type.toLowerCase(),
          })
        },
        COMPLETE: { target: "idle" },
        FINISH: { target: "finished" },
        ERROR: { target: "error" },
      },
    },
    finished: {
      type: "final" as const,
      entry: [
        ({ context }: { context: CounterContext }) => ({
          type: `machine.${id}.finished`,
          count: context.count,
          lastMessage: context.lastMessage,
        })
      ]
    },
    error: {
      on: {
        RETRY: { target: "processing" },
      },
    },
  },
});