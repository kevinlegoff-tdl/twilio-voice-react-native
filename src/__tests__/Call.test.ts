import { createNativeCallInfo, mockCallNativeEvents } from '../__mocks__/Call';
import type { NativeEventEmitter as MockNativeEventEmitterType } from '../__mocks__/common';
import { createStatsReport } from '../__mocks__/RTCStats';
import { Call } from '../Call';
import { NativeEventEmitter, NativeModule } from '../common';
import { Constants } from '../constants';
import type { NativeCallEventType } from '../type/Call';

const MockNativeEventEmitter =
  NativeEventEmitter as unknown as typeof MockNativeEventEmitterType;
const MockNativeModule = jest.mocked(NativeModule);
let MockTwilioError: jest.Mock;
let mockConstructTwilioError: jest.Mock;

jest.mock('../common');
jest.mock('../error/utility', () => {
  MockTwilioError = jest.fn();
  mockConstructTwilioError = jest.fn((mesage, code) => {
    return new MockTwilioError(mesage, code);
  });
  return {
    constructTwilioError: mockConstructTwilioError,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  MockNativeEventEmitter.reset();
});

describe('Call class', () => {
  describe('constructor', () => {
    it('creates an event handler mapping', () => {
      const call = new Call(createNativeCallInfo());
      /* eslint-disable-next-line dot-notation */
      expect(call['_nativeEventHandler']).toBeDefined();
    });

    it('contains an entry for every call event', () => {
      const call = new Call(createNativeCallInfo());
      /* eslint-disable-next-line dot-notation */
      const nativeEventHandler = call['_nativeEventHandler'];
      [
        Constants.CallEventConnected,
        Constants.CallEventConnectFailure,
        Constants.CallEventDisconnected,
        Constants.CallEventReconnected,
        Constants.CallEventReconnecting,
        Constants.CallEventRinging,
        Constants.CallEventQualityWarningsChanged,
      ].forEach((event: string) => {
        expect(event in nativeEventHandler).toBe(true);
      });
    });

    it('binds to the native event emitter', () => {
      const call = new Call(createNativeCallInfo());
      expect(MockNativeEventEmitter.addListener.mock.calls).toEqual([
        // eslint-disable-next-line dot-notation
        [Constants.ScopeCall, call['_handleNativeEvent']],
      ]);
    });
  });

  describe('on receiving a valid native event', () => {
    /**
     * Test cases that apply to all call events.
     */
    Object.values(mockCallNativeEvents).forEach(({ name, nativeEvent }) => {
      describe(name, () => {
        it('handles events for matching uuids', () => {
          const call = new Call(createNativeCallInfo());
          const intermediateSpy =
            MockNativeEventEmitter.expectListenerAndReturnSpy(
              0,
              Constants.ScopeCall,
              call['_handleNativeEvent'] // eslint-disable-line dot-notation
            );
          const handlerSpy = jest.spyOn(
            call['_nativeEventHandler'], // eslint-disable-line dot-notation
            nativeEvent.type as NativeCallEventType
          );
          MockNativeEventEmitter.emit(Constants.ScopeCall, nativeEvent);
          expect(intermediateSpy.mock.calls).toEqual([[nativeEvent]]);
          expect(handlerSpy.mock.calls).toEqual([[nativeEvent]]);
        });

        it('ignores events for non-matching uuids', () => {
          const overrideEvent = {
            ...nativeEvent,
            call: {
              ...nativeEvent.call,
              uuid: 'mock-nativecallinfo-nonmatchinguuid',
            },
          };
          const call = new Call(createNativeCallInfo());
          const intermediateSpy =
            MockNativeEventEmitter.expectListenerAndReturnSpy(
              0,
              Constants.ScopeCall,
              call['_handleNativeEvent'] // eslint-disable-line dot-notation
            );
          const handlerSpy = jest.spyOn(
            call['_nativeEventHandler'], // eslint-disable-line dot-notation
            nativeEvent.type as NativeCallEventType
          );
          MockNativeEventEmitter.emit(Constants.ScopeCall, overrideEvent);
          expect(intermediateSpy.mock.calls).toEqual([[overrideEvent]]);
          expect(handlerSpy.mock.calls).toEqual([]);
        });

        it('updates the call info', () => {
          const diffFrom = 'mock-nativecallinfo-differentfrom';
          const diffSid = 'mock-nativecallinfo-differentsid';
          const diffTo = 'mock-nativecallinfo-differentto';

          const call = new Call(createNativeCallInfo());
          const updateSpy = jest.spyOn(call, '_update' as any);
          MockNativeEventEmitter.emit(Constants.ScopeCall, {
            ...nativeEvent,
            call: {
              ...createNativeCallInfo(),
              from: diffFrom,
              sid: diffSid,
              to: diffTo,
            },
          });

          expect(updateSpy).toHaveBeenCalledTimes(1);
          expect(call.getFrom()).toBe(diffFrom);
          expect(call.getTo()).toBe(diffTo);
          expect(call.getSid()).toBe(diffSid);
        });
      });
    });

    /**
     * Event forwarding tests.
     */
    const listenerCalledWithoutArgs = (listenerMock: jest.Mock) => {
      expect(listenerMock).toHaveBeenCalledTimes(1);
      expect(listenerMock).toHaveBeenNthCalledWith(1);
    };

    const listenerCalledWithGenericError = (listenerMock: jest.Mock) => {
      expect(listenerMock).toHaveBeenCalledTimes(1);
      const args = listenerMock.mock.calls[0];
      expect(args).toHaveLength(1);

      const [error] = args;
      expect(error).toBeInstanceOf(MockTwilioError);
    };

    const listenerCalledWithQualityWarnings = (listenerMock: jest.Mock) => {
      expect(listenerMock).toHaveBeenCalledTimes(1);
      const args = listenerMock.mock.calls[0];
      expect(args).toHaveLength(2);

      const [currentWarnings, previousWarnings] = args;
      expect(Array.isArray(currentWarnings)).toBe(true);
      expect(Array.isArray(previousWarnings)).toBe(true);
    };

    (
      [
        // Example test case configuration:
        // [
        //   native event received by the call object,
        //   call event emitted by the call object,
        //   assertion to perform on the listener
        // ],
        [
          mockCallNativeEvents.connected,
          Call.Event.Connected,
          listenerCalledWithoutArgs,
        ],
        [
          mockCallNativeEvents.connectFailure,
          Call.Event.ConnectFailure,
          listenerCalledWithGenericError,
        ],
        [
          mockCallNativeEvents.disconnected,
          Call.Event.Disconnected,
          listenerCalledWithoutArgs,
        ],
        [
          mockCallNativeEvents.disconnectedWithError,
          Call.Event.Disconnected,
          listenerCalledWithGenericError,
        ],
        [
          mockCallNativeEvents.reconnected,
          Call.Event.Reconnected,
          listenerCalledWithoutArgs,
        ],
        [
          mockCallNativeEvents.reconnecting,
          Call.Event.Reconnecting,
          listenerCalledWithGenericError,
        ],
        [
          mockCallNativeEvents.ringing,
          Call.Event.Ringing,
          listenerCalledWithoutArgs,
        ],
        [
          mockCallNativeEvents.qualityWarningsChanged,
          Call.Event.QualityWarningsChanged,
          listenerCalledWithQualityWarnings,
        ],
      ] as const
    ).forEach(([{ name, nativeEvent }, callEvent, assertion]) => {
      describe(name, () => {
        it('re-emits the native event', () => {
          const call = new Call(createNativeCallInfo());
          const listenerMock = jest.fn();
          call.on(callEvent, listenerMock);

          MockNativeEventEmitter.emit(Constants.ScopeCall, nativeEvent);

          assertion(listenerMock);
        });

        it('invokes the correct event handler', () => {
          const call = new Call(createNativeCallInfo());
          const spy = jest.spyOn(
            call['_nativeEventHandler'], // eslint-disable-line dot-notation
            nativeEvent.type as NativeCallEventType
          );

          MockNativeEventEmitter.emit(Constants.ScopeCall, nativeEvent);

          expect(spy).toHaveBeenCalledTimes(1);
        });
      });
    });

    /**
     * EventTypeStateMap update tests, applies to a subset of call events.
     */
    (
      [
        [mockCallNativeEvents.connected, Call.State.Connected],
        [mockCallNativeEvents.connectFailure, Call.State.Disconnected],
        [mockCallNativeEvents.disconnected, Call.State.Disconnected],
        [mockCallNativeEvents.disconnectedWithError, Call.State.Disconnected],
        [mockCallNativeEvents.reconnected, Call.State.Connected],
        [mockCallNativeEvents.reconnecting, Call.State.Reconnecting],
        [mockCallNativeEvents.ringing, Call.State.Ringing],
      ] as const
    ).forEach(([{ name, nativeEvent }, state]) => {
      describe(name, () => {
        it('updates the call state', () => {
          const call = new Call(createNativeCallInfo());
          const updateSpy = jest.spyOn(call, '_update' as any);

          MockNativeEventEmitter.emit(Constants.ScopeCall, { ...nativeEvent });

          expect(updateSpy).toHaveBeenCalledTimes(1);
          expect(call.getState()).toBe(state);
        });
      });
    });

    /**
     * Event case-specific tests.
     */
    describe(Constants.CallEventQualityWarningsChanged, () => {
      it('does not update the call state', () => {
        const call = new Call(createNativeCallInfo());
        const updateSpy = jest.spyOn(call, '_update' as any);

        expect(updateSpy).toHaveBeenCalledTimes(0);
        expect(call.getState()).toBe(Call.State.Connecting);

        MockNativeEventEmitter.emit(
          Constants.ScopeCall,
          mockCallNativeEvents.connected.nativeEvent
        );
        expect(updateSpy).toHaveBeenCalledTimes(1);
        expect(call.getState()).toBe(Call.State.Connected);

        MockNativeEventEmitter.emit(
          Constants.ScopeCall,
          mockCallNativeEvents.qualityWarningsChanged.nativeEvent
        );
        expect(updateSpy).toHaveBeenCalledTimes(2);

        // State should still be `connected` and unaffected by the quality
        // warnings changed event
        expect(call.getState()).toBe(Call.State.Connected);
      });
    });
  });

  describe('uses the error constructor', () => {
    [
      Constants.CallEventConnectFailure,
      Constants.CallEventDisconnected,
      Constants.CallEventReconnecting,
    ].forEach((ev) => {
      it(ev, () => {
        new Call(createNativeCallInfo()); // eslint-disable-line no-new
        const errorEvent = {
          type: Constants.CallEventConnectFailure,
          call: createNativeCallInfo(),
          error: { code: 99999, message: 'foobar' },
        };
        MockNativeEventEmitter.emit(Constants.ScopeCall, errorEvent);

        expect(mockConstructTwilioError.mock.calls).toEqual([
          ['foobar', 99999],
        ]);
        expect(mockConstructTwilioError.mock.calls).toHaveLength(
          mockConstructTwilioError.mock.instances.length
        );
      });
    });
  });

  /**
   * Generic call object tests.
   */
  describe('on receiving an invalid native event', () => {
    it('throws an error', () => {
      new Call(createNativeCallInfo()); // eslint-disable-line no-new
      expect(() =>
        MockNativeEventEmitter.emit(Constants.ScopeCall, {
          type: 'mock-call-eventtype',
        })
      ).toThrowError(
        'Unknown call event type received from the native layer: ' +
          '"mock-call-eventtype".'
      );
    });
  });

  describe('public methods', () => {
    describe('.disconnect', () => {
      it('invokes the native module', async () => {
        await new Call(createNativeCallInfo()).disconnect();
        expect(MockNativeModule.call_disconnect.mock.calls).toEqual([
          ['mock-nativecallinfo-uuid'],
        ]);
      });

      it('returns a Promise<void>', async () => {
        const disconnectPromise = new Call(createNativeCallInfo()).disconnect();
        await expect(disconnectPromise).resolves.toBe(undefined);
      });
    });

    describe('.isMuted', () => {
      it('returns the mute value', () => {
        const isMuted = new Call(createNativeCallInfo()).isMuted();
        expect(isMuted).toBe(false);
      });
    });

    describe('.isOnHold', () => {
      it('returns the hold value', () => {
        const isOnHold = new Call(createNativeCallInfo()).isOnHold();
        expect(isOnHold).toBe(false);
      });
    });

    describe('.getCustomParameters', () => {
      it('returns the customParameters value', () => {
        const customParameters = new Call(
          createNativeCallInfo()
        ).getCustomParameters();
        expect(customParameters).toEqual({
          'mock-nativecallinfo-custom-parameter-key1':
            'mock-nativecallinfo-custom-parameter-value1',
          'mock-nativecallinfo-custom-parameter-key2':
            'mock-nativecallinfo-custom-parameter-value2',
        });
      });
    });

    describe('.getFrom', () => {
      it('returns the from value', () => {
        const from = new Call(createNativeCallInfo()).getFrom();
        expect(from).toBe('mock-nativecallinfo-from');
      });
    });

    describe('.getSid', () => {
      it('returns the sid value', () => {
        const sid = new Call(createNativeCallInfo()).getSid();
        expect(sid).toBe('mock-nativecallinfo-sid');
      });
    });

    describe('.getState', () => {
      it('returns the call state', () => {
        const state = new Call(createNativeCallInfo()).getState();
        expect(state).toBe(Call.State.Connecting);
      });
    });

    describe('.getStats', () => {
      it('invokes the native module', async () => {
        await new Call(createNativeCallInfo()).getStats();
        expect(MockNativeModule.call_getStats.mock.calls).toEqual([
          ['mock-nativecallinfo-uuid'],
        ]);
      });

      it('returns the call stats', async () => {
        const statsPromise = new Call(createNativeCallInfo()).getStats();
        await expect(statsPromise).resolves.toEqual(createStatsReport());
      });
    });

    describe('.getTo', () => {
      it('returns the to value', () => {
        const to = new Call(createNativeCallInfo()).getTo();
        expect(to).toBe('mock-nativecallinfo-to');
      });
    });

    describe('.hold', () => {
      it('invokes the native module', async () => {
        for (const doHold of [true, false]) {
          jest.clearAllMocks();
          MockNativeEventEmitter.reset();

          await new Call(createNativeCallInfo()).hold(doHold);
          expect(MockNativeModule.call_hold.mock.calls).toEqual([
            ['mock-nativecallinfo-uuid', doHold],
          ]);
        }
      });

      it('returns the hold value', async () => {
        for (const doHold of [true, false]) {
          jest.clearAllMocks();
          MockNativeEventEmitter.reset();

          const holdPromise = new Call(createNativeCallInfo()).hold(doHold);
          await expect(holdPromise).resolves.toBe(doHold);
        }
      });
    });

    describe('.mute', () => {
      it('invokes the native module', async () => {
        for (const doMute of [true, false]) {
          jest.clearAllMocks();
          MockNativeEventEmitter.reset();

          await new Call(createNativeCallInfo()).mute(doMute);
          expect(MockNativeModule.call_mute.mock.calls).toEqual([
            ['mock-nativecallinfo-uuid', doMute],
          ]);
        }
      });

      it('returns the mute value', async () => {
        for (const doMute of [true, false]) {
          jest.clearAllMocks();
          MockNativeEventEmitter.reset();

          const mutePromise = new Call(createNativeCallInfo()).mute(doMute);
          expect(mutePromise).resolves.toBe(doMute);
        }
      });
    });

    describe('.sendDigits', () => {
      it('invokes the native module', async () => {
        const digits = '12345';
        await new Call(createNativeCallInfo()).sendDigits(digits);
        expect(MockNativeModule.call_sendDigits.mock.calls).toEqual([
          ['mock-nativecallinfo-uuid', digits],
        ]);
      });

      it('returns a Promise<void>', async () => {
        const sendDigitsPromise = new Call(createNativeCallInfo()).sendDigits(
          '12345'
        );
        await expect(sendDigitsPromise).resolves.toBe(undefined);
      });
    });

    describe('.postFeedback', () => {
      it('invokes the native module', async () => {
        const issue = Call.Issue.AudioLatency;
        const score = Call.Score.Three;

        await new Call(createNativeCallInfo()).postFeedback(score, issue);
        expect(MockNativeModule.call_postFeedback.mock.calls).toEqual([
          ['mock-nativecallinfo-uuid', score, issue],
        ]);
      });

      it('returns a Promise<void>', async () => {
        const issue = Call.Issue.AudioLatency;
        const score = Call.Score.Three;

        const postFeedbackPromise = new Call(
          createNativeCallInfo()
        ).postFeedback(score, issue);
        await expect(postFeedbackPromise).resolves.toBe(undefined);
      });
    });
  });

  describe('private methods', () => {
    /**
     * Invalid event tests.
     */
    [
      '_handleNativeEvent',
      '_handleConnectedEvent',
      '_handleConnectFailureEvent',
      '_handleDisconnectedEvent',
      '_handleReconnectingEvent',
      '_handleReconnectedEvent',
      '_handleRingingEvent',
      '_handleQualityWarningsChangedEvent',
    ].forEach((privateMethodKey) => {
      describe(`.${privateMethodKey}`, () => {
        it('throws an error for an invalid event', () => {
          const handler = (new Call(createNativeCallInfo()) as any)[
            privateMethodKey
          ];
          expect(typeof handler).toBe('function');
          expect(() => {
            handler({ type: 'not-a-real-event' });
          }).toThrow();
        });
      });
    });
  });
});

describe('Call namespace', () => {
  describe('exports enumerations', () => {
    it('Event', () => {
      expect(Call.Event).toBeDefined();
      expect(typeof Call.Event).toBe('object');
    });

    it('State', () => {
      expect(Call.State).toBeDefined();
      expect(typeof Call.State).toBe('object');
    });

    it('EventTypeStateMap', () => {
      expect(Call.EventTypeStateMap).toBeDefined();
      expect(typeof Call.EventTypeStateMap).toBe('object');
    });

    it('QualityWarning', () => {
      expect(Call.QualityWarning).toBeDefined();
      expect(typeof Call.QualityWarning).toBe('object');
    });

    it('Score', () => {
      expect(Call.Score).toBeDefined();
      expect(typeof Call.Score).toBe('object');
    });

    it('Issue', () => {
      expect(Call.Issue).toBeDefined();
      expect(typeof Call.Issue).toBe('object');
    });
  });
});
