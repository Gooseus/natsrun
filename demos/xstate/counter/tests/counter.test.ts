import type { Msg, Subscription } from '@nats-io/nats-core';
import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { connect } from '@nats-io/transport-node';
import { createCounter } from '../machines/index.ts';
import { createNatsActor } from '../../actors/index.ts';

describe('Counter Machine', () => {
  const MACHINE_ID = 'test-counter';
  let nc: any;
  let actor: any;

  before(async () => {
    nc = await connect({ servers: 'nats://localhost:4222' });
  });

  after(async () => {
    await nc.close();
  });

  beforeEach(() => {
    const machine = createCounter(MACHINE_ID, 0);
    actor = createNatsActor(machine, nc);
    actor.start();
  });

  afterEach(() => {
    actor.stop();
  });

  describe('Unit Tests', () => {
    it('should start in idle state', () => {
      assert.strictEqual(actor.getSnapshot().value, 'idle');
    });

    it('should increment count on COUNT events', () => {
      actor.send({ type: 'START' });
      actor.send({ type: 'COUNT' });
      actor.send({ type: 'COUNT' });
      
      assert.strictEqual(actor.getSnapshot().context.count, 2);
    });

    it('should transition to finished state and emit final count', () => {
      let finalCount = 0;
      
      actor.subscribe((state: any) => {
        if (state.matches('finished')) {
          finalCount = state.context.count;
        }
      });

      actor.send({ type: 'START' });
      actor.send({ type: 'COUNT' });
      actor.send({ type: 'COUNT' });
      actor.send({ type: 'FINISH' });

      assert.strictEqual(actor.getSnapshot().value, 'finished');
      assert.strictEqual(finalCount, 2);
    });
  });

  describe('NATS Integration Tests', () => {
    it('should handle NATS messages and update state', async () => {
      const stateChanges: any[] = [];
      actor.subscribe((state: any) => {
        stateChanges.push(state.value);
      });

      await nc.publish(`machine.${MACHINE_ID}.start`, '');
      await nc.publish(`machine.${MACHINE_ID}.count`, '');
      await nc.publish(`machine.${MACHINE_ID}.count`, '');
      await nc.publish(`machine.${MACHINE_ID}.finish`, '');

      await new Promise(resolve => setTimeout(resolve, 100));

      assert.ok(stateChanges.includes('processing'));
      assert.ok(stateChanges.includes('finished'));
      assert.strictEqual(actor.getSnapshot().context.count, 2);
    });

    it('should broadcast final count when finished', async () => {
      const receivedCount = new Promise<any>((resolve, reject) => {
        (async (sub: Subscription) => {
          for await (const msg of sub) {
            try {
              resolve(JSON.parse(msg.data.toString()));
            } catch (error) {
              reject(error);
            }
            sub.unsubscribe();
            break; 
          }
        })(nc.subscribe(`machine.${MACHINE_ID}.complete`));
      });

      await nc.publish(`machine.${MACHINE_ID}.start`, '');
      await nc.publish(`machine.${MACHINE_ID}.count`, '');
      await nc.publish(`machine.${MACHINE_ID}.count`, '');
      await nc.publish(`machine.${MACHINE_ID}.finish`, '');

      await new Promise(resolve => setTimeout(resolve, 100));

      const { count } = await receivedCount;
      assert.strictEqual(count, 2);
    });
  });
}); 