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
  const progress = timeline.length > 1 ? currentIndex / (timeline.length - 1) : 0;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);

  const stepForward = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, maxIndex));
  }, [maxIndex]);

  const stepBack = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const seekTo = useCallback(
    (index: number) => {
      setCurrentIndex(Math.max(0, Math.min(index, maxIndex)));
    },
    [maxIndex]
  );

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
  }, []);

  useEffect(() => {
    clearTimer();
    if (!isPlaying) return;

    const ms = Math.max(200, 1200 / speed);
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
    currentIndex,
    maxIndex,
    progress,
    isPlaying,
    speed,
    setSpeed,
    play,
    pause,
    stepForward,
    stepBack,
    seekTo,
    reset,
    totalSteps: timeline.length,
  };
}
