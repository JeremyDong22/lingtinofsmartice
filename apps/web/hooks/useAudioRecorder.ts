// Audio Recorder Hook - Handle browser audio recording
// v1.8 - Added Screen Wake Lock, improved interruption recovery (interrupted state, pagehide, foreground health check)

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// MIME type detection with fallback chain for cross-browser compatibility
// Safari < 18.4 only supports audio/mp4, Chrome/Firefox support audio/webm
function getSupportedMimeType(): string | undefined {
  const types = [
    'audio/webm;codecs=opus', // Best quality: Chrome, Firefox, Safari 18.4+
    'audio/webm', // Fallback webm
    'audio/mp4', // Safari < 18.4, iOS Safari, WeChat iOS WebView
    'audio/ogg;codecs=opus', // Firefox alternative
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`[useAudioRecorder] Using mimeType: ${type}`);
      return type;
    }
  }
  console.warn(
    '[useAudioRecorder] No preferred mimeType supported, using browser default'
  );
  return undefined;
}

export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  analyserData: Uint8Array | null;
}

export interface AudioRecorderActions {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

export function useAudioRecorder(): [AudioRecorderState, AudioRecorderActions] {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  // Guard against duplicate calls using ref (survives across renders)
  const isStartingRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  // Use refs for animation loop to avoid stale closure issues
  const isRecordingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  // Throttle waveform updates for smoother animation
  const lastUpdateTimeRef = useRef<number>(0);
  const WAVEFORM_UPDATE_INTERVAL = 50; // Update every 50ms (20fps) instead of every frame (60fps)
  // Store visibilitychange handler ref for proper cleanup
  const visibilityHandlerRef = useRef<(() => void) | null>(null);
  // Screen Wake Lock to prevent screen dimming during recording (iOS 16.4+, all modern browsers)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // Store pagehide handler ref for cleanup (iOS PWA may skip visibilitychange on eviction)
  const pagehideHandlerRef = useRef<(() => void) | null>(null);
  // Store devicechange handler ref for cleanup (Android: Bluetooth headset connect/disconnect)
  const deviceChangeHandlerRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
      }
      if (pagehideHandlerRef.current) {
        window.removeEventListener('pagehide', pagehideHandlerRef.current);
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
      if (deviceChangeHandlerRef.current) {
        navigator.mediaDevices?.removeEventListener('devicechange', deviceChangeHandlerRef.current);
      }
    };
  }, []);

  // --- Screen Wake Lock helpers ---
  // Keeps screen on during recording; auto-released by browser on tab hide, re-acquired on visible

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      console.log('[useAudioRecorder] Wake Lock acquired');
      wakeLockRef.current.addEventListener('release', () => {
        console.log('[useAudioRecorder] Wake Lock released by system');
      });
    } catch (err) {
      // Non-fatal: recording still works, screen may just dim
      console.warn('[useAudioRecorder] Wake Lock request failed:', err);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch { /* already released */ }
      wakeLockRef.current = null;
    }
  }, []);

  // --- Interruption recovery helpers ---

  // Shared cleanup: release mic, stop timer/animation, close AudioContext, release Wake Lock
  const cleanupResources = useCallback(() => {
    isRecordingRef.current = false;
    isPausedRef.current = false;
    setIsRecording(false);
    setIsPaused(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAnalyserData(null);
    if (visibilityHandlerRef.current) {
      document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
      visibilityHandlerRef.current = null;
    }
    if (pagehideHandlerRef.current) {
      window.removeEventListener('pagehide', pagehideHandlerRef.current);
      pagehideHandlerRef.current = null;
    }
    if (deviceChangeHandlerRef.current) {
      navigator.mediaDevices?.removeEventListener('devicechange', deviceChangeHandlerRef.current);
      deviceChangeHandlerRef.current = null;
    }
    releaseWakeLock();
  }, [releaseWakeLock]);

  // Emergency save: salvage already-recorded chunks when recording is interrupted
  const emergencySave = useCallback((recorder: MediaRecorder | null) => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    isRecordingRef.current = false; // Prevent re-entry from health check

    const chunks = audioChunksRef.current;

    // Try normal stop (triggers onstop → blob generation)
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
        // onstop callback will handle blob + reset isStoppingRef
        // Safety: if onstop never fires (mobile browser killed recorder), reset after 2s
        setTimeout(() => { isStoppingRef.current = false; }, 2000);
      } catch {
        // stop() failed — manually assemble blob from chunks
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
          setAudioBlob(blob);
          setAudioUrl(URL.createObjectURL(blob));
        }
        isStoppingRef.current = false;
      }
    } else if (chunks.length > 0) {
      // Recorder already inactive — manually assemble
      const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      isStoppingRef.current = false;
    } else {
      isStoppingRef.current = false;
    }

    cleanupResources();
    setError('录音被中断，已保存已录制部分');
  }, [cleanupResources]);

  // Detect app going to background / returning to foreground during recording
  const handleVisibilityChange = useCallback(() => {
    if (!isRecordingRef.current) return;

    if (document.hidden) {
      // Going to background — check if MediaRecorder was silently killed
      console.warn('[useAudioRecorder] App went to background during recording');
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === 'inactive') {
        emergencySave(recorder);
      }
    } else {
      // Returning to foreground — run health checks and try to recover
      console.log('[useAudioRecorder] App returned to foreground during recording');

      const recorder = mediaRecorderRef.current;
      const ctx = audioContextRef.current;

      // Check if MediaRecorder was killed while in background
      if (recorder && recorder.state === 'inactive') {
        console.warn('[useAudioRecorder] MediaRecorder died in background');
        emergencySave(recorder);
        return;
      }

      // Check if any mic track ended (OS revoked mic access during call/background)
      const tracks = streamRef.current?.getAudioTracks() ?? [];
      if (tracks.length === 0 || tracks.some((t) => t.readyState === 'ended')) {
        console.warn('[useAudioRecorder] Mic track ended while in background');
        emergencySave(recorder);
        return;
      }

      // Try to resume AudioContext if it was suspended/interrupted (iOS phone call scenario)
      if (ctx && (ctx.state === 'suspended' || ctx.state === ('interrupted' as AudioContextState))) {
        ctx.resume().then(() => {
          console.log('[useAudioRecorder] AudioContext resumed after foreground return');
        }).catch(() => {
          // AudioContext unrecoverable — recording audio is likely silent, emergency save
          console.warn('[useAudioRecorder] AudioContext resume failed on foreground return');
          emergencySave(recorder);
        });
      }

      // Re-acquire Wake Lock (browser auto-releases on tab hide)
      acquireWakeLock();
    }
  }, [emergencySave, acquireWakeLock]);

  // Animation loop for waveform visualization (uses refs to avoid stale closures)
  // Uses getByteTimeDomainData for evenly distributed amplitude data (not frequency)
  // Throttled to 20fps for smoother, slower animation
  const startVisualization = useCallback(() => {
    const updateAnalyserData = (timestamp: number) => {
      if (analyserRef.current && isRecordingRef.current && !isPausedRef.current) {
        // Throttle updates to slow down the animation
        if (timestamp - lastUpdateTimeRef.current >= WAVEFORM_UPDATE_INTERVAL) {
          lastUpdateTimeRef.current = timestamp;
          const dataArray = new Uint8Array(analyserRef.current.fftSize);
          // Use time domain data (amplitude over time) instead of frequency data
          // This gives evenly distributed values across the array
          analyserRef.current.getByteTimeDomainData(dataArray);
          setAnalyserData(dataArray);
        }
        animationFrameRef.current = requestAnimationFrame(updateAnalyserData);
      }
    };
    animationFrameRef.current = requestAnimationFrame(updateAnalyserData);
  }, []);

  const startRecording = useCallback(async () => {
    // Guard against duplicate starts
    if (isStartingRef.current || mediaRecorderRef.current?.state === 'recording') {
      console.log('[useAudioRecorder] Ignoring duplicate start call');
      return;
    }
    isStartingRef.current = true;

    try {
      setError(null);
      audioChunksRef.current = [];

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      // Set up Web Audio API for visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // iOS: AudioContext enters 'interrupted'/'suspended' on incoming calls
      // Both states need recovery attempts; 'interrupted' is a Safari-specific non-standard state
      audioContextRef.current.addEventListener('statechange', () => {
        const ctx = audioContextRef.current;
        if (!ctx || !isRecordingRef.current) return;
        if (ctx.state === 'suspended' || ctx.state === ('interrupted' as AudioContextState)) {
          console.warn(`[useAudioRecorder] AudioContext ${ctx.state}, attempting resume`);
          ctx.resume().catch(() => {
            console.warn('[useAudioRecorder] AudioContext resume failed, emergency saving');
            emergencySave(mediaRecorderRef.current);
          });
        }
      });

      // Set up MediaRecorder with cross-browser MIME type detection
      const mimeType = getSupportedMimeType();
      // 96kbps balances file size and STT accuracy in noisy restaurant environments
      // Mobile Safari uses audio/mp4 (AAC) which defaults to 128kbps+ without this limit
      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 96000,
      };
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }
      const mediaRecorder = new MediaRecorder(stream, recorderOptions);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Use actual mimeType from recorder for proper format handling
        const blob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        // Reset stopping guard after MediaRecorder fully stops
        isStoppingRef.current = false;
      };

      // Catch recording errors (e.g. phone call interruption)
      mediaRecorder.onerror = (event) => {
        console.error('[useAudioRecorder] MediaRecorder error:', event);
        emergencySave(mediaRecorder);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms

      // Update refs BEFORE state (refs are synchronous)
      isRecordingRef.current = true;
      isPausedRef.current = false;

      setIsRecording(true);
      setIsPaused(false);
      startTimeRef.current = Date.now();

      // Start duration timer + health check
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));

        // Health check: detect if MediaRecorder was silently killed by the OS
        const rec = mediaRecorderRef.current;
        if (rec && rec.state === 'inactive' && isRecordingRef.current) {
          console.warn('[useAudioRecorder] MediaRecorder silently stopped');
          emergencySave(rec);
        }
      }, 1000);

      // Detect app going to background
      visibilityHandlerRef.current = handleVisibilityChange;
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // pagehide: iOS PWA may skip visibilitychange when system evicts the page
      const handlePageHide = () => {
        if (isRecordingRef.current) {
          console.warn('[useAudioRecorder] pagehide fired during recording');
          emergencySave(mediaRecorderRef.current);
        }
      };
      pagehideHandlerRef.current = handlePageHide;
      window.addEventListener('pagehide', handlePageHide);

      // Keep screen on during recording (prevents dimming/lock)
      await acquireWakeLock();

      // Android/all: detect mic track ending (Bluetooth disconnect, mic unplug, OS revokes mic)
      // This fires immediately — much faster than the 1s health check interval
      stream.getAudioTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          if (!isRecordingRef.current) return;
          console.warn(`[useAudioRecorder] Audio track ended: ${track.label}`);
          emergencySave(mediaRecorderRef.current);
        });
      });

      // Android/all: detect audio device changes (Bluetooth headset connect/disconnect)
      // If our mic track died after a device change, emergency save
      const handleDeviceChange = () => {
        if (!isRecordingRef.current) return;
        const tracks = streamRef.current?.getAudioTracks() ?? [];
        if (tracks.length === 0 || tracks.every((t) => t.readyState === 'ended')) {
          console.warn('[useAudioRecorder] All mic tracks ended after device change');
          emergencySave(mediaRecorderRef.current);
        }
      };
      deviceChangeHandlerRef.current = handleDeviceChange;
      navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);

      // Start visualization (now refs are already set)
      startVisualization();
    } catch (err) {
      setError(err instanceof Error ? err.message : '无法访问麦克风');
      console.error('Recording error:', err);
    } finally {
      isStartingRef.current = false;
    }
  }, [startVisualization, emergencySave, handleVisibilityChange, acquireWakeLock]);

  const stopRecording = useCallback(() => {
    // Guard against duplicate stops using ref (more reliable than state)
    if (isStoppingRef.current) {
      console.log('[useAudioRecorder] Ignoring duplicate stop call');
      return;
    }

    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      console.log('[useAudioRecorder] MediaRecorder not active, skipping stop');
      return;
    }

    isStoppingRef.current = true;

    // Stop MediaRecorder (triggers onstop → blob)
    mediaRecorder.stop();

    // Release all resources
    cleanupResources();
  }, [cleanupResources]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      isPausedRef.current = true;
      setIsPaused(true);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      isPausedRef.current = false;
      setIsPaused(false);
      startVisualization();
    }
  }, [isRecording, isPaused, startVisualization]);

  const resetRecording = useCallback(() => {
    setAudioBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    setAnalyserData(null);
    audioChunksRef.current = [];
  }, [audioUrl]);

  return [
    { isRecording, isPaused, duration, audioBlob, audioUrl, error, analyserData },
    { startRecording, stopRecording, pauseRecording, resumeRecording, resetRecording },
  ];
}
