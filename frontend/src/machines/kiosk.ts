import { setup } from 'xstate';

export const kioskMachine = setup({
  types: {
    context: {} as {
      transcript: string;
    },
    events: {} as
      | { type: 'PRESENCE_DETECTED' }
      | { type: 'AUDIO_CHUNK_RECEIVED' }
      | { type: 'TURN_COMPLETE' }
      | { type: 'TIMEOUT_INACTIVITY' }
      | { type: 'SESSION_END_TOOL' },
  },
  actions: {},
}).createMachine({
  id: 'kiosk',
  initial: 'idle',
  context: {
    transcript: '',
  },
  states: {
    idle: {
      on: {
        PRESENCE_DETECTED: 'listening'
      }
    },
    listening: {
      on: {
        AUDIO_CHUNK_RECEIVED: 'active',
        TIMEOUT_INACTIVITY: 'idle'
      }
    },
    active: {
      on: {
        SESSION_END_TOOL: 'farewell',
        TIMEOUT_INACTIVITY: 'idle'
      }
    },
    farewell: {
      after: {
        5000: 'idle' // after 5 seconds of farewell, return to idle
      }
    }
  }
});
