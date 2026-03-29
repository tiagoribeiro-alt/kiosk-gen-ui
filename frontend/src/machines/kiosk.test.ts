import { createActor } from 'xstate'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { INACTIVITY_TIMEOUT_MS, kioskMachine, LISTENING_TIMEOUT_MS } from './kiosk'

describe('kioskMachine', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('promotes listening to active when a ui snapshot arrives', () => {
    const actor = createActor(kioskMachine).start()

    actor.send({ type: 'PRESENCE_DETECTED' })
    actor.send({ type: 'UI_SNAPSHOT_RECEIVED' })

    expect(actor.getSnapshot().value).toBe('active')
  })

  it('moves active to farewell when the session end tool fires', () => {
    const actor = createActor(kioskMachine).start()

    actor.send({ type: 'PRESENCE_DETECTED' })
    actor.send({ type: 'AUDIO_CHUNK_RECEIVED' })
    actor.send({ type: 'SESSION_END_TOOL' })

    expect(actor.getSnapshot().value).toBe('farewell')
  })

  it('returns listening to idle after the listening timeout elapses', () => {
    vi.useFakeTimers()
    const actor = createActor(kioskMachine).start()

    actor.send({ type: 'PRESENCE_DETECTED' })
    vi.advanceTimersByTime(LISTENING_TIMEOUT_MS)

    expect(actor.getSnapshot().value).toBe('idle')
  })

  it('resets the active inactivity timer when new activity arrives', () => {
    vi.useFakeTimers()
    const actor = createActor(kioskMachine).start()

    actor.send({ type: 'PRESENCE_DETECTED' })
    actor.send({ type: 'ACTIVITY_DETECTED' })
    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1_000)
    actor.send({ type: 'ACTIVITY_DETECTED' })
    vi.advanceTimersByTime(1_500)

    expect(actor.getSnapshot().value).toBe('active')

    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS)

    expect(actor.getSnapshot().value).toBe('idle')
  })
})