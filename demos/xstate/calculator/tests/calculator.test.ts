import type { Msg } from '@nats-io/nats-core';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { connect } from '@nats-io/transport-node';
import { createCalculator } from '../machines/index.ts';
import { createNatsActor } from '../../actors/index.ts';

describe('Calculator', () => {
  const MACHINE_ID = 'test-calculator';
  let nc: any;
  let actor: any;

  before(async () => {
    nc = await connect({ servers: 'nats://localhost:4222' });
  });

  after(async () => {
    await nc.close();
  });

  beforeEach(() => {
    const machine = createCalculator(MACHINE_ID, 0);
    actor = createNatsActor(machine, nc);
    actor.start();
  });

  afterEach(() => {
    actor.stop();
  });

  describe('Calculator Machine', () => {
    describe('Powering On/Off', () => {
      it('should start in off state', () => {
        assert.strictEqual(actor.getSnapshot().value, 'powered_off');
      });

      it('should turn on', () => {
        actor.send({ type: 'POWER_ON' });
        assert.strictEqual(actor.getSnapshot().value, 'powered_on');
      });

      it('should turn off', () => {
        actor.send({ type: 'POWER_OFF' });
        assert.strictEqual(actor.getSnapshot().value, 'powered_off');
      });

      it('should clear context when turning off', () => {
        actor.send({ type: 'POWER_ON' });
        actor.send({ type: 'ENTER', value: 10 });
        assert.strictEqual(actor.getSnapshot().context.stack.length, 1);
        assert.strictEqual(actor.getSnapshot().context.stackIndex, 1);
        actor.send({ type: 'POWER_OFF' });
        assert.strictEqual(actor.getSnapshot().context.stack.length, 0);
        assert.strictEqual(actor.getSnapshot().context.opStack.length, 0);
        assert.strictEqual(actor.getSnapshot().context.stackIndex, 0);
        assert.strictEqual(actor.getSnapshot().context.opStackIndex, 0);
        assert.strictEqual(actor.getSnapshot().context.error, false);
      });
    });

    describe('Basic Operations', () => {
      beforeEach(() => {
        actor.send({ type: 'POWER_ON' });
      });

      describe('Adding', () => {
        it('should add', () => {
          actor.send({ type: 'ENTER', value: 10 });
          actor.send({ type: 'ADD' });
          actor.send({ type: 'ENTER', value: 10 });
          actor.send({ type: 'EQUAL' });
          assert.strictEqual(actor.getSnapshot().context.stack[0], 20);
        });
      });

      describe('Subtracting', () => {
        it('should subtract', () => {
          actor.send({ type: 'ENTER', value: 10 });
          actor.send({ type: 'SUBTRACT' });
          actor.send({ type: 'ENTER', value: 5 });
          actor.send({ type: 'EQUAL' });
          assert.strictEqual(actor.getSnapshot().context.stack[0], 5);
        }); 
      });

      describe('Multiplying', () => {
        it('should multiply', () => {
          actor.send({ type: 'ENTER', value: 10 });
          actor.send({ type: 'MULTIPLY' });
          actor.send({ type: 'ENTER', value: 2 });
          actor.send({ type: 'EQUAL' });
          assert.strictEqual(actor.getSnapshot().context.stack[0], 20);
        });
      });

      describe('Dividing', () => {
        it('should divide', () => {
          actor.send({ type: 'ENTER', value: 10 });
          actor.send({ type: 'DIVIDE' });
          actor.send({ type: 'ENTER', value: 2 });
          actor.send({ type: 'EQUAL' });
          assert.strictEqual(actor.getSnapshot().context.stack[0], 5);
        });
      });

      describe('Equal', () => {
        it('should equal', () => {
          actor.send({ type: 'ENTER', value: 10 });
          actor.send({ type: 'EQUAL' });
          assert.strictEqual(actor.getSnapshot().context.stack[0], 10);
        }); 
      });
    });

    describe('Error Handling', () => {
      it('should error', () => {
        actor.send({ type: 'POWER_ON' });
        actor.send({ type: 'ENTER', value: 10 });
        actor.send({ type: 'ERROR' });
        assert.strictEqual(actor.getSnapshot().context.error, true);
      });
    });
    
    describe('Clearing', () => {
      it('should clear', () => {
        actor.send({ type: 'POWER_ON' });
        actor.send({ type: 'ENTER', value: 10 });
        actor.send({ type: 'ADD' });
        actor.send({ type: 'ENTER', value: 10 });
        actor.send({ type: 'EQUAL' });
        assert.strictEqual(actor.getSnapshot().context.stack[0], 20);

        actor.send({ type: 'CLEAR' });
        assert.strictEqual(actor.getSnapshot().context.stack[0], undefined);
      });
    });
    
    describe('Complex Operations', () => {
      it('should do a bunch of operations', () => {
        actor.send({ type: 'POWER_ON' });
        actor.send({ type: 'ENTER', value: 10 });
        actor.send({ type: 'ADD' });
        actor.send({ type: 'ENTER', value: 10 });
        actor.send({ type: 'ADD' });
        actor.send({ type: 'ENTER', value: 10 });
        actor.send({ type: 'ADD' });
        actor.send({ type: 'ENTER', value: 2 });
        actor.send({ type: 'EQUAL' });
        assert.strictEqual(actor.getSnapshot().context.stack[0], 32);
        actor.send({ type: 'MULTIPLY' });
        actor.send({ type: 'ENTER', value: 20 });
        actor.send({ type: 'ADD' });
        actor.send({ type: 'ENTER', value: 2 });
        actor.send({ type: 'EQUAL' });
        assert.strictEqual(actor.getSnapshot().context.stack[0], 642);
      });
    });
  });

  describe('NATS Integration Tests', () => {
  });
}); 