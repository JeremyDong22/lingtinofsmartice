# Recording UX Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two employee-reported issues: (1) screen turning off kills recording on HarmonyOS, (2) no way to discard a recording after accidentally hitting stop.

**Architecture:** Wake Lock API integration in the existing `useAudioRecorder` hook to prevent screen dimming during recording. New `pendingConfirmation` state in the recorder page that intercepts the auto-save flow, showing save/discard buttons before uploading.

**Tech Stack:** Screen Wake Lock API, React state management, Tailwind CSS

---

### Task 1: Add Wake Lock to useAudioRecorder

**Files:**
- Modify: `apps/web/hooks/useAudioRecorder.ts`

**Step 1: Add Wake Lock ref and acquire/release helpers**

After `visibilityHandlerRef` (line 75), add a ref and two helpers:

```typescript
const wakeLockRef = useRef<WakeLockSentinel | null>(null);
```

Add cleanup in the unmount effect (line 78-96), inside the return function:

```typescript
if (wakeLockRef.current) {
  wakeLockRef.current.release().catch(() => {});
}
```

Add two helper functions after `handleVisibilityChange` (after line 177):

```typescript
const acquireWakeLock = useCallback(async () => {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLockRef.current = await navigator.wakeLock.request('screen');
    console.log('[useAudioRecorder] Wake Lock acquired');
    wakeLockRef.current.addEventListener('release', () => {
      console.log('[useAudioRecorder] Wake Lock released');
    });
  } catch (err) {
    console.warn('[useAudioRecorder] Wake Lock failed:', err);
  }
}, []);

const releaseWakeLock = useCallback(() => {
  if (wakeLockRef.current) {
    wakeLockRef.current.release().catch(() => {});
    wakeLockRef.current = null;
  }
}, []);
```

**Step 2: Acquire Wake Lock on recording start**

In `startRecording`, after `startVisualization()` (line 307), add:

```typescript
acquireWakeLock();
```

Add `acquireWakeLock` to the `useCallback` deps array on line 314.

**Step 3: Release Wake Lock on stop and cleanup**

In `cleanupResources` (line 101-128), before the final `setAnalyserData(null)` (line 123), add:

```typescript
releaseWakeLock();
```

Add `releaseWakeLock` to the `useCallback` deps array for `cleanupResources`.

**Step 4: Re-acquire Wake Lock on visibility change (tab becomes visible again)**

In `handleVisibilityChange` (line 169-177), add an else branch for when the page becomes visible again:

```typescript
const handleVisibilityChange = useCallback(() => {
  if (document.hidden && isRecordingRef.current) {
    console.warn('[useAudioRecorder] App went to background during recording');
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'inactive') {
      emergencySave(recorder);
    }
  } else if (!document.hidden && isRecordingRef.current) {
    // Re-acquire wake lock when returning to foreground
    acquireWakeLock();
  }
}, [emergencySave, acquireWakeLock]);
```

**Step 5: Build and verify**

Run: `cd /Users/apple/Desktop/门店语音系统 && pnpm build:web`
Expected: Build succeeds with no TypeScript errors.

**Step 6: Commit**

```bash
git add apps/web/hooks/useAudioRecorder.ts
git commit -m "feat(recorder): add Wake Lock API to prevent screen off during recording"
```

---

### Task 2: Add post-stop confirmation UI (save/discard)

**Files:**
- Create: `apps/web/components/recorder/RecordingConfirmation.tsx`
- Modify: `apps/web/app/(main)/recorder/page.tsx`

**Step 1: Create RecordingConfirmation component**

Create `apps/web/components/recorder/RecordingConfirmation.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';

interface RecordingConfirmationProps {
  duration: number;
  onSave: () => void;
  onDiscard: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function RecordingConfirmation({ duration, onSave, onDiscard }: RecordingConfirmationProps) {
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<HTMLSpanElement>(null);

  // 30-second auto-save countdown
  useEffect(() => {
    let remaining = 30;
    const tick = () => {
      remaining--;
      if (countdownRef.current) {
        countdownRef.current.textContent = `${remaining}`;
      }
      if (remaining <= 0) {
        onSave();
      }
    };
    autoSaveTimerRef.current = setInterval(tick, 1000);
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [onSave]);

  return (
    <div className="glass-card rounded-2xl p-5 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <p className="text-center text-sm text-gray-500 mb-1">录音已停止</p>
      <p className="text-center text-3xl font-mono text-gray-800 mb-4">{formatDuration(duration)}</p>
      <div className="flex gap-3">
        <button
          onClick={onDiscard}
          className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all"
        >
          丢弃
        </button>
        <button
          onClick={onSave}
          className="flex-[2] py-3 rounded-xl text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 active:scale-[0.98] transition-all shadow-sm"
        >
          保存
        </button>
      </div>
      <p className="text-center text-xs text-gray-400 mt-3">
        <span ref={countdownRef}>30</span>秒后自动保存
      </p>
    </div>
  );
}
```

**Step 2: Modify recorder page to intercept auto-save with confirmation**

In `apps/web/app/(main)/recorder/page.tsx`:

2a. Add import for the new component (after existing imports, ~line 22):

```typescript
import { RecordingConfirmation } from '@/components/recorder/RecordingConfirmation';
```

2b. Add `pendingConfirmation` state (after `pendingSave` state, line 72):

```typescript
const [pendingConfirmation, setPendingConfirmation] = useState(false);
```

Also add a ref to store the duration at stop time (after `pendingMeetingTypeRef`, line 88):

```typescript
const stoppedDurationRef = useRef<number>(0);
```

2c. Modify `handleVisitStop` (lines 235-240) to set confirmation instead of pendingSave:

```typescript
const handleVisitStop = useCallback(async () => {
  pendingTableIdRef.current = tableId;
  stoppedDurationRef.current = duration;
  stopRecording();
  setPendingConfirmation(true);
  setTableId('');
}, [stopRecording, tableId, duration]);
```

2d. Modify `handleMeetingStop` (lines 251-256) similarly:

```typescript
const handleMeetingStop = useCallback(async () => {
  pendingMeetingTypeRef.current = meetingType;
  stoppedDurationRef.current = duration;
  stopRecording();
  setPendingConfirmation(true);
  setMeetingType('');
}, [stopRecording, meetingType, duration]);
```

2e. Add confirmation handlers (after handleStop, ~line 260):

```typescript
const handleConfirmSave = useCallback(() => {
  setPendingConfirmation(false);
  setPendingSave(true);
}, []);

const handleConfirmDiscard = useCallback(() => {
  setPendingConfirmation(false);
  pendingTableIdRef.current = '';
  pendingMeetingTypeRef.current = '';
  resetRecording();
  showToast('录音已丢弃', 'info');
}, [resetRecording, showToast]);
```

2f. Add the confirmation UI in the JSX. Replace the waveform section (lines 493-503) with:

```tsx
{/* Waveform Visualizer - only visible when recording */}
{isRecording && (
  <div className="glass-card rounded-2xl p-4 mb-6">
    <WaveformVisualizer
      analyserData={analyserData}
      isRecording={isRecording}
    />
    <p className="text-center text-2xl font-mono text-gray-700 mt-3">
      {formatDuration(duration)}
    </p>
  </div>
)}

{/* Post-stop confirmation */}
{pendingConfirmation && !isRecording && (
  <RecordingConfirmation
    duration={stoppedDurationRef.current}
    onSave={handleConfirmSave}
    onDiscard={handleConfirmDiscard}
  />
)}
```

**Step 3: Build and verify**

Run: `cd /Users/apple/Desktop/门店语音系统 && pnpm build:web`
Expected: Build succeeds with no TypeScript errors.

**Step 4: Commit**

```bash
git add apps/web/components/recorder/RecordingConfirmation.tsx apps/web/app/\(main\)/recorder/page.tsx
git commit -m "feat(recorder): add save/discard confirmation after stopping recording"
```

---

### Task 3: Manual testing

**Steps:**
1. `pnpm dev` — start local dev server
2. Open `http://localhost:3000/recorder`
3. **Test Wake Lock**: Start recording → observe screen stays on → stop recording → screen can dim again
4. **Test Confirmation**: Start recording → stop → verify save/discard buttons appear → test "丢弃" discards → test "保存" saves normally → test 30s auto-save countdown
5. **Test meeting mode**: Same confirmation flow works in meeting mode

---

### Task 4: Update product feedback status

After deployment, mark the two feedback items as resolved:

```sql
UPDATE lingtin_product_feedback
SET status = 'resolved', resolved_version = '<new_version>'
WHERE id IN (
  '66e98609-1f37-492f-aec5-b6e956502220',  -- 息屏录音失效
  '3303b4f6-b676-4e28-a95d-012dd32c5b6e'   -- 误触无法删除
);
```
