import type { ReplaySpeed } from "./replay-config";

const speedFactor: Record<ReplaySpeed, number> = {
  "1x": 1,
  "5x": 5,
  "20x": 20,
  max: Number.POSITIVE_INFINITY,
};

export class ReplayClock {
  private currentMs: number;
  private paused = false;
  private speed: ReplaySpeed = "1x";

  constructor(initialTime: string) {
    this.currentMs = new Date(initialTime).getTime();
  }

  now(): string {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(this.currentMs));
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}+08:00`;
  }

  tick(realElapsedMs = 60_000): string {
    if (!this.paused) {
      const factor = speedFactor[this.speed];
      this.currentMs += factor === Number.POSITIVE_INFINITY ? 240 * 60_000 : realElapsedMs * factor;
    }
    return this.now();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  reset(initialTime: string): void {
    this.currentMs = new Date(initialTime).getTime();
    this.paused = false;
    this.speed = "1x";
  }

  setSpeed(speed: ReplaySpeed): void {
    this.speed = speed;
  }
}
