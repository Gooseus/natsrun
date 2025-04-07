import { assign, setup } from "xstate";
import type { ActorRefFrom } from "xstate";

export type IPFActor = ActorRefFrom<typeof createIPFWorker>;

export interface IPFMetadata {
  n: number;
  vc: Array<[string, string[]]>;
}

type CategoricalObservation = string[];

interface IPFContext {
  metadata: IPFMetadata | null;
  rowFrequencyTable: Record<string, number>;
  frequencyTable: Array<Array<number>>;
  independentEntropy: Array<number>;
  saturatedEntropy: number;
  receivedCount: number;
  error: string | null;
}

export type TStartEvent = { type: "START"; metadata: IPFMetadata };
type TDataEvent = { type: "DATA"; observation: CategoricalObservation };
type TCompleteEvent = { type: "COMPLETE" };
type TErrorEvent = { type: "ERROR"; error: string };
type IPFEvent = TStartEvent | TDataEvent | TCompleteEvent | TErrorEvent;

const initializeFrequencyTable = ({ event }: { event: TStartEvent }) => {
  const table: Array<Array<number>> = [];
  for (const [_, vals] of event.metadata.vc) {
    table.push(new Array(vals.length).fill(0));
  }
  return table;
};

const updateFrequencyTable = ({ context, event }: { context: IPFContext; event: IPFEvent }) => {
  if (event?.type !== "DATA") return context.frequencyTable;
  if (context.metadata === null) throw new Error("Metadata is not set");

  const newTable = [...context.frequencyTable];
  const { vc } = context.metadata;
  for (var i = 0; i < vc.length; i++) {
    const [_, values] = vc[i];
    const idx = values.indexOf(event.observation[i]);
    if (newTable[i]) {
      newTable[i][idx] = (newTable[i][idx] || 0) + 1;
    }
  }
  return newTable;
};

const updateRowFrequencyTable = ({ context, event }: { context: IPFContext; event: IPFEvent }) => {
  if (event?.type !== "DATA") return context.rowFrequencyTable;
  if (context.metadata === null) throw new Error("Metadata is not set");

  const { observation } = event;
  const key = observation.join(',');
  context.rowFrequencyTable[key] = (context.rowFrequencyTable[key] || 0) + 1;
  return context.rowFrequencyTable;
}

const createProbabilityTable = ({ context }: { context: IPFContext }) => {
  const { metadata, frequencyTable } = context;
  if (!metadata || !frequencyTable) return [];
  return frequencyTable.map((row) => row.map((val) => val / metadata.n));
}

const calculateEntropy = ({ context }: { context: IPFContext }) => {
  return createProbabilityTable({ context }).map((row) => row.reduce((sum, val) => sum + val * -Math.log2(val), 0));
}

const calculateTotalEntropy = ({ context }: { context: IPFContext }) => {
  const { rowFrequencyTable, metadata } = context;
  if(!metadata) throw new Error("Metadata is not set");
  const frequencies = Object.values(rowFrequencyTable);
  if(frequencies.length === metadata.n) return 0;
  if (frequencies.length === 0) return 0;
  return frequencies.map((val) => val / metadata.n).reduce((sum, val) => sum + val * -Math.log2(val), 0);
}

const incrementCount = ({ context }: { context: IPFContext }) => context.receivedCount + 1;

const setError = ({ event }: { event: IPFEvent }) => (event?.type === "ERROR" ? event.error : null);

const isDataComplete = ({ context }: { context: IPFContext }) => context.metadata !== null && context.receivedCount === context.metadata.n;

type TIPFGuard = ({ event }: { event: IPFEvent }) => boolean;
const hasMissingMetadata: TIPFGuard = ({ event }) => {
  try {
    const { metadata } = event as TStartEvent;
    return !metadata;
  } catch (e) {
    return true;
  }
};
const hasInvalidRows: TIPFGuard = ({ event }) => {
  try {
    const { metadata } = event as TStartEvent;
    return metadata.n <= 0;
  } catch (e) {
    return true;
  }
};
const hasInvalidVariables: TIPFGuard = ({ event }) => {
  try {
    const { metadata } = event as TStartEvent;
    return !metadata.vc || metadata.vc.length <= 0;
  } catch (e) {
    return true;
  }
};
const hasInvalidVariableValues: TIPFGuard = ({ event }) => {
  try {
    const { metadata } = event as TStartEvent;
    return metadata.vc.some(([_, values]) => !Array.isArray(values) || values.length <= 0);
  } catch (e) {
    return true;
  }
};
export const createIPFWorker = (id: string) => {
  const initialContext: IPFContext = {
    metadata: null,
    frequencyTable: [],
    rowFrequencyTable: {},
    independentEntropy: [],
    saturatedEntropy: 0,
    receivedCount: 0,
    error: null,
  };

  return setup({
    types: {
      context: {} as IPFContext,
      events: {} as IPFEvent,
    },
    guards: {
      hasMissingMetadata,
      hasInvalidRows,
      hasInvalidVariables,
      hasInvalidVariableValues,
    },
    actions: {
      updateFrequencyTable,
      incrementCount,
      setError,
      calculateEntropy,
      updateRowFrequencyTable,
    },
  }).createMachine({
    id,
    initial: "idle",
    context: initialContext,
    states: {
      idle: {
        on: {
          START: [
            {
              guard: 'hasMissingMetadata',
              actions: assign({ error: 'Invalid metadata: must send metadata', }),
              target: "error"
            },
            {
              guard: 'hasInvalidRows',
              actions: assign({ error: 'Invalid metadata: must send a valid record number', }),
              target: "error"
            },
            {
              guard: 'hasInvalidVariables',
              actions: assign({ error: 'Invalid metadata: must send a valid set of variables', }),
              target: "error",
            },
            {
              guard: 'hasInvalidVariableValues',
              actions: assign({ error: 'Invalid metadata: must send a valid set of variable values', }),
              target: "error",
            },
            {
              actions: assign({
                metadata: ({ event }: { event: TStartEvent }) => event.metadata,
                frequencyTable: initializeFrequencyTable,
              }),
              target: "receiving",
            },
          ],
        },
      },
      receiving: {
        on: {
          DATA: {
            actions: assign({
              frequencyTable: updateFrequencyTable,
              receivedCount: incrementCount,
              rowFrequencyTable: updateRowFrequencyTable,
            }),
            target: "receiving",
          },
          COMPLETE: [
            {
              guard: isDataComplete,
              actions: [
                assign({
                  independentEntropy: calculateEntropy,
                  saturatedEntropy: calculateTotalEntropy,
                }),
                assign({
                  rowFrequencyTable: ({ context }) => ({}),
                }),
              ],
              target: "completed",
            },
            {
              actions: assign({ error: 'Invalid data: data records must match records expected', }),
              target: "error",
            },
          ],
          ERROR: {
            actions: assign({ error: setError, }),
            target: "error",
          },
        },
      },
      completed: {
        type: "final",
      },
      error: {
        type: "final",
        entry: assign({
          error: ({ context }) => context.error,
        }),
      },
    },
  });
};
