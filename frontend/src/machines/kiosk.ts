import { setup } from 'xstate'

export const FAREWELL_DURATION_MS = 15_000
export const LISTENING_TIMEOUT_MS = 5_000
export const INACTIVITY_TIMEOUT_MS = 30_000

export function getLifecycleTimeoutMs(state: 'idle' | 'listening' | 'active' | 'farewell'): number | null {
  if (state === 'listening') {
    return LISTENING_TIMEOUT_MS
  }

  if (state === 'active') {
    return INACTIVITY_TIMEOUT_MS
  }

  return null
}

export const kioskMachine = setup({
  types: {
    context: {} as {
      transcript: string
    },
    events: {} as
      | { type: 'PRESENCE_DETECTED' }
      | { type: 'ACTIVITY_DETECTED' }
      | { type: 'AUDIO_CHUNK_RECEIVED' }
      | { type: 'UI_SNAPSHOT_RECEIVED' }
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
      after: {
        [LISTENING_TIMEOUT_MS]: 'idle'
      },
      on: {
        ACTIVITY_DETECTED: 'active',
        AUDIO_CHUNK_RECEIVED: 'active',
        UI_SNAPSHOT_RECEIVED: 'active',
        TIMEOUT_INACTIVITY: 'idle'
      }
    },
    active: {
      after: {
        [INACTIVITY_TIMEOUT_MS]: 'idle'
      },
      on: {
        ACTIVITY_DETECTED: {
          target: 'active',
          reenter: true,
        },
        AUDIO_CHUNK_RECEIVED: {
          target: 'active',
          reenter: true,
        },
        UI_SNAPSHOT_RECEIVED: {
          target: 'active',
          reenter: true,
        },
        SESSION_END_TOOL: 'farewell',
        TIMEOUT_INACTIVITY: 'idle'
      }
    },
    farewell: {
      after: {
        [FAREWELL_DURATION_MS]: 'idle'
      }
    }
  }
})
