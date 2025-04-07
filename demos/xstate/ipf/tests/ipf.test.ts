import type { NatsConnection } from '@nats-io/nats-core';
import type { IPFMetadata } from '../machines/ipf';
import { after, before, describe, it} from 'node:test';
import assert from 'node:assert';
import { connect } from '@nats-io/transport-node';
import { createActor } from 'xstate';
import { createIPFWorker } from '../machines/index.ts';
import { createNatsActor } from '../../actors/nats.ts';

describe('IPF Worker Integration Tests', () => {
  let nc: NatsConnection;
  
  before(async () => {
    nc = await connect({ servers: 'nats://localhost:4222' });
  });

  after(async () => {
    await nc.close();
  });

  it('should process observations and complete successfully', async () => {
    const metadata: IPFMetadata = {
      n: 6,
      vc: [
        ["age", ["0", "1"]],
        ["income", ["0", "1"]],
      ],
    };

    const testData = [
      ["0", "0"],
      ["0", "1"],
      ["0", "1"],
      ["0", "1"],
      ["1", "0"],
      ["1", "1"]
    ];

    const ipfWorker = createIPFWorker('test-ipf');
    const actor = createActor(ipfWorker);
    
    // Subscribe to state changes
    const states: any[] = [];
    actor.subscribe(state => {
      states.push(state.value);
    });

    // Start the actor
    actor.start();
    
    // Send START event
    actor.send({ type: 'START', metadata });

    // Send test observations
    for (const observation of testData) {
      actor.send({ type: 'DATA', observation });
    }

    // Send COMPLETE event
    actor.send({ type: 'COMPLETE' });

    // Wait for final state
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('states', actor.getSnapshot().value, actor.getSnapshot().context);
    // Verify state transitions
    assert.deepEqual(states, ['idle', 'receiving', 'receiving', 'receiving', 'receiving', 'receiving', 'receiving', 'receiving', 'completed']);

    // Verify final frequency table
    const finalState = actor.getSnapshot();
    assert.deepEqual(finalState.context.frequencyTable, [
      [ 4, 2 ],
      [ 2, 4 ]
    ]);
  });

  it('should handle errors appropriately', async () => {
    const ipfWorker = createIPFWorker('test-ipf-error');
    const actor = createActor(ipfWorker);
    
    const states: any[] = [];
    actor.subscribe(state => {
      states.push(state.value);
    });

    actor.start();
    actor.send({ type: 'START', metadata: { n: 1, vc: [['age', ['0', '1']]] } });
    actor.send({ type: 'ERROR', error: 'Test error' });

    await new Promise(resolve => setTimeout(resolve, 100));
    
    assert.deepEqual(states, ['idle', 'receiving', 'error']);
    assert.equal(actor.getSnapshot().context.error, 'Test error');
  });

  describe('Metadata Validation', () => {
    it('should fail when metadata is not sent', async () => {
      const invalidMetadata = null;
      
      const ipfWorker = createIPFWorker('test-ipf-validation');
      const actor = createActor(ipfWorker);
      
      actor.start();
      actor.send({ type: 'START', metadata: invalidMetadata as unknown as IPFMetadata });

      const snapshot = actor.getSnapshot();
      assert.equal(snapshot.value, 'error');
      assert.equal(snapshot.context.error, 'Invalid metadata: must send metadata');
    });
    
    it('should fail when metadata has an invalid record number (n) value', async () => {
      const invalidMetadata = {
        n: -1,  // Invalid value
        vc: [
          ['age', [0, 1]],
          ['income', [0, 1]]
        ]
      };

      const ipfWorker = createIPFWorker('test-ipf-validation');
      const actor = createActor(ipfWorker);
      
      actor.start();
      actor.send({ type: 'START', metadata: invalidMetadata as IPFMetadata });

      const snapshot = actor.getSnapshot();
      assert.equal(snapshot.value, 'error');
      assert.equal(snapshot.context.error, 'Invalid metadata: must send a valid record number');
    });

    it('should fail when metadata categorical variables are empty', async () => {
      const invalidMetadata = {
        n: 10,
        vc: []
      };

      const ipfWorker = createIPFWorker('test-ipf-validation');
      const actor = createActor(ipfWorker);
      
      actor.start();
      actor.send({ type: 'START', metadata: invalidMetadata as IPFMetadata });
      
      const snapshot = actor.getSnapshot();
      assert.equal(snapshot.value, 'error');
      assert.equal(snapshot.context.error, 'Invalid metadata: must send a valid set of variables');
    });

    it('should fail when metadata categorical variable values are not arrays', async () => {
      const invalidMetadata = {
        n: 10, 
        vc: [
          ['age', 2], // not an array
          ['income', 3] // not an array
        ]
      };

      const ipfWorker = createIPFWorker('test-ipf-validation');
      const actor = createActor(ipfWorker);
      
      actor.start();
      actor.send({ type: 'START', metadata: invalidMetadata as IPFMetadata });

      const snapshot = actor.getSnapshot();
      assert.equal(snapshot.value, 'error');
      assert.equal(snapshot.context.error, 'Invalid metadata: must send a valid set of variable values');
    });
  });

  it('should handle NATS integration correctly', async () => {
    const metadata: IPFMetadata = {
      n: 2,
      vc: [['category', ['0', '1']]]
    };

    const ipfWorker = createIPFWorker('test-ipf-nats');
    const actor = createNatsActor(ipfWorker, nc);
    
    // Subscribe to NATS results
    const sub = nc.subscribe('machine.ipf.results');
    (async () => {
      try {
        for await (const msg of sub) {
          const result = JSON.parse(msg.data.toString());
          
          assert.deepEqual(result, [ [1, 1] ]);
          sub.unsubscribe();
          break;
        }
      } catch (error) {
        throw error;
      } finally {
        sub.unsubscribe();
      }
    })();
    
    actor.start();
    actor.send({ type: 'START', metadata });

    // Publish test data through NATS
    await nc.publish('machine.ipf.data', JSON.stringify([0]));
    await nc.publish('machine.ipf.data', JSON.stringify([1]));

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
  });
});
