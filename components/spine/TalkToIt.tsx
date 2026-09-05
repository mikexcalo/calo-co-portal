'use client';

/**
 * Say it instead of typing it.
 *
 * WHY THE BROWSER AND NOT A TRANSCRIPTION API
 *
 * Speech recognition is built into Chrome, Edge and Safari and costs nothing
 * per minute. A hosted transcription service would be better at accents and
 * crosstalk, and would also put a meter on the one thing you want to do
 * without thinking about it. Talking to your own notes should not have a
 * per-minute price, so dictation is free and only the reading step, which
 * happens once per note, spends anything.
 *
 * The trade is honest and worth naming: this is dictation, not a meeting
 * recorder. It hears the microphone in front of it, so it is for you talking
 * after a call, not for capturing the call itself.
 *
 * WHY THE TRANSCRIPT IS EDITABLE BEFORE IT GOES ANYWHERE
 *
 * Recognition mishears numbers and names constantly, and those are exactly the
 * fields that matter. You see the text and fix it before anything reads it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, C, Card, inputStyle } from './ui';

/** The vendor-prefixed constructor, which is still how Chrome ships it. */
interface RecognitionCtor {
  new (): SpeechRecognitionLike;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, RecognitionCtor | undefined>;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function TalkToIt({
  onText,
  label = 'Talk',
}: {
  onText: (text: string) => void;
  label?: string;
}) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const ref = useRef<SpeechRecognitionLike | null>(null);
  /**
   * The committed text, held in a ref as well as state.
   *
   * onresult fires from outside React's update cycle, so reading `heard` from
   * state inside the handler gives whatever it was when the handler was
   * created and silently drops everything said since.
   */
  const committed = useRef('');

  useEffect(() => { setSupported(recognitionCtor() !== null); }, []);

  const stop = useCallback(() => {
    ref.current?.stop();
    ref.current = null;
    setListening(false);
    setInterim('');
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setError(null);

    const r = new Ctor();
    r.continuous = true;
    // Interim results are what make it feel alive. Without them you talk into
    // silence for ten seconds and assume it is broken.
    r.interimResults = true;
    r.lang = 'en-US';

    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) committed.current += chunk;
        else live += chunk;
      }
      setHeard(committed.current);
      setInterim(live);
    };

    r.onerror = (e) => {
      // "aborted" is what you get from stopping deliberately, and "no-speech"
      // from a pause. Neither is a failure worth showing.
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      setError(
        e.error === 'not-allowed'
          ? 'The microphone is blocked. Allow it in the address bar and try again.'
          : `Speech recognition stopped: ${e.error}`
      );
      stop();
    };

    // Chrome ends the session on its own after a pause. Restart while the
    // person still thinks it is listening, or half a note goes missing.
    r.onend = () => { if (ref.current === r) { try { r.start(); } catch { /* already going */ } } };

    ref.current = r;
    setListening(true);
    try { r.start(); } catch { setError('Could not start listening.'); setListening(false); }
  }, [stop]);

  useEffect(() => () => { ref.current?.stop(); ref.current = null; }, []);

  if (supported === false) {
    return (
      <div style={{ fontSize: 12.5, color: C.faint, marginBottom: 10 }}>
        This browser cannot do speech. Chrome, Edge and Safari can; Firefox cannot. Typing works
        everywhere.
      </div>
    );
  }

  const text = (heard + interim).trim();

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: text ? 9 : 0 }}>
        <button
          onClick={listening ? stop : start}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 13.5, fontWeight: 500,
            border: `1px solid ${listening ? C.red : C.border}`,
            background: listening ? C.redSoft : 'transparent',
            color: listening ? C.red : C.text,
          }}
        >
          <span
            style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: listening ? C.red : C.borderStrong,
            }}
          />
          {listening ? 'Stop' : label}
        </button>

        {listening && (
          <span style={{ fontSize: 12.5, color: C.faint }}>
            Listening. Say it however it comes out; you can fix the text before it goes anywhere.
          </span>
        )}
      </div>

      {error && <div style={{ fontSize: 12.5, color: C.red, marginBottom: 8 }}>{error}</div>}

      {text && (
        <Card>
          <textarea
            value={text}
            onChange={(e) => { committed.current = e.target.value; setHeard(e.target.value); setInterim(''); }}
            rows={Math.min(12, Math.max(3, Math.ceil(text.length / 70)))}
            style={{ ...inputStyle, fontSize: 13.5, lineHeight: 1.6, resize: 'vertical', width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              onClick={() => { stop(); onText(text); committed.current = ''; setHeard(''); setInterim(''); }}
              disabled={text.length < 2}
            >
              Use this
            </Button>
            <Button
              variant="ghost"
              onClick={() => { committed.current = ''; setHeard(''); setInterim(''); }}
            >
              Clear
            </Button>
            <span style={{ fontSize: 12, color: C.faint }}>
              {text.split(/\s+/).filter(Boolean).length} words. Check names and numbers.
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
