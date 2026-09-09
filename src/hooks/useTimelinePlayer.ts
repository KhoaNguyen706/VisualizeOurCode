"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TimelineFrame } from "@/lib/types";

interface UseTimelinePlayerOptions {
  timeline: TimelineFrame[];
  initialSpeed?: number;
}

export function useTimelinePlayer({ timeline, initialSpeed = 1 }: UseTimelinePlayerOptions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxIndex = Math.max(0, timeline.length - 1);
  const currentFrame = timeline[currentIndex] ?? timeline[0];
  const prevFrame = currentIndex > 0 ? timeline[currentIndex - 1] : undefined;
  const progress = timeline.length > 1 ? currentIndex / (timeline.length - 1) : 0;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    // Pressing play at the end means "watch it again", not "stay here".
    setCurrentIndex((i) => (i >= maxIndex ? 0 : i));
    setIsPlaying(true);
  }, [maxIndex]);
  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => {
    setIsPlaying((p) => {
      if (!p) setCurrentIndex((i) => (i >= maxIndex ? 0 : i));
      return !p;
    });
  }, [maxIndex]);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((i) => Math.min(i + 1, maxIndex));
  }, [maxIndex]);

  const stepBack = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  // Read through a ref so a seek scheduled across a timeline swap clamps to
  // the timeline that is current when it fires, not the one it was made under.
  const maxRef = useRef(maxIndex);
  maxRef.current = maxIndex;
  const seekTo = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, maxRef.current)));
  }, []);

  const seekToEnd = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(maxIndex);
  }, [maxIndex]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
  }, []);

  /**
   * Jump to the next (or previous) frame that passes a test — the next
   * decision, the next return, the next time a line is reached.
   */
  const seekWhere = useCallback(
    (test: (frame: TimelineFrame, index: number) => boolean, direction: 1 | -1) => {
      setIsPlaying(false);
      setCurrentIndex((i) => {
        for (let k = i + direction; k >= 0 && k <= maxIndex; k += direction) {
          if (test(timeline[k], k)) return k;
        }
        return i;
      });
    },
    [timeline, maxIndex]
  );

  useEffect(() => {
    clearTimer();
    if (!isPlaying) return;

    const ms = Math.max(120, 1200 / speed);
    intervalRef.current = setInterval(() => {
      setCurrentIndex((i) => {
        if (i >= maxIndex) {
          setIsPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, ms);

    return clearTimer;
  }, [isPlaying, speed, maxIndex, clearTimer]);

  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [timeline]);

  return {
    currentFrame,
    prevFrame,
    currentIndex,
    maxIndex,
    progress,
    isPlaying,
    speed,
    setSpeed,
    play,
    pause,
    toggle,
    stepForward,
    stepBack,
    seekTo,
    seekToEnd,
    seekWhere,
    reset,
    totalSteps: timeline.length,
  };
}
