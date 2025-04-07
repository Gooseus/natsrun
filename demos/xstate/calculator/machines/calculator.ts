import { createMachine, assign } from "xstate";

type CalculatorEvent =
  | { type: "POWER_ON" }
  | { type: "POWER_OFF" }
  | { type: "ADD"; value: number }
  | { type: "SUBTRACT"; value: number }
  | { type: "MULTIPLY"; value: number }
  | { type: "DIVIDE"; value: number }
  | { type: "CLEAR" }
  | { type: "EQUAL" }
  | { type: "ERROR" }
  | { type: "BACK" };

interface CalculatorContext {
  stack: number[];
  stackIndex: number;
  opStack: ((a: number, b: number) => number)[];
  opStackIndex: number;
  error: boolean;
}

export const createCalculator = (id: string, start = Number.NaN) => {
  const initialContext: CalculatorContext = {
    stack: [],
    stackIndex: 0,
    opStack: [],
    opStackIndex: 0,
    error: false,
  };

  return createMachine({
    id,
    initial: "powered_off",
    context: initialContext,
    states: {
      powered_off: {
        entry: assign(initialContext),
        on: {
          POWER_ON: {
            target: "powered_on",
            actions: assign(initialContext),
          },
        },
      },
      error: {
        on: {
          POWER_OFF: "powered_off",
          CLEAR: {
            target: "powered_on",
            actions: assign(initialContext),
          },
        },
      },
      powered_on: {
        entry: assign(initialContext),
        on: {
          POWER_OFF: "powered_off",
          ENTER: {
            actions: assign({
              stack: ({ context, event }) => [...context.stack, event.value],
              stackIndex: ({ context }) => context.stackIndex + 1,
            }),
          },
          ADD: {
            actions: assign({
              opStack: ({ context }) => [...context.opStack, (a: number, b: number) => a + b],
              opStackIndex: ({ context }) => context.opStackIndex + 1,
            }),
          },
          SUBTRACT: {
            actions: assign({
              opStack: ({ context }) => [...context.opStack, (a: number, b: number) => a - b],
              opStackIndex: ({ context }) => context.opStackIndex + 1,
            }),
          },
          MULTIPLY: {
            actions: assign({
              opStack: ({ context }) => [...context.opStack, (a: number, b: number) => a * b],
              opStackIndex: ({ context }) => context.opStackIndex + 1,
            }),
          },
          DIVIDE: {
            actions: assign({
              opStack: ({ context }) => [...context.opStack, (a: number, b: number) => a / b],
              opStackIndex: ({ context }) => context.opStackIndex + 1,
            }),
          },
          CLEAR: {
            actions: assign(initialContext),
          },
          EQUAL: {
            guard: ({ context }) => context.opStackIndex > 0 && context.stackIndex > context.opStackIndex,
            actions: assign({
              stack: ({ context }) => {
                for (let i = 0; i < context.opStackIndex; i++) {
                  const op = context.opStack.shift();
                  const a = context.stack.shift();
                  const b = context.stack.shift();
                  if (a === undefined || b === undefined || op === undefined) {
                    return context.stack;
                  }
                  context.stack = [op(a, b), ...context.stack];
                }
                return context.stack;
              },
              stackIndex: ({ context }) => context.stackIndex - context.opStackIndex,
              opStack: () => [],
              opStackIndex: () => 0,
            }),
          },
          ERROR: {
            actions: assign({
              error: true,
            }),
          },
        },
      },
    },
  });
};
