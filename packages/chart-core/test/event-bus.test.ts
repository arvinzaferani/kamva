import { describe, expect, it } from "vitest";
import { EventBus } from "../src/event-bus.js";

type Events = { ping: number; empty: undefined };

describe("EventBus", () => {
  it("delivers payloads to subscribers", () => {
    const bus = new EventBus<Events>();
    const received: number[] = [];
    bus.on("ping", (n) => received.push(n));
    bus.emit("ping", 1);
    bus.emit("ping", 2);
    expect(received).toEqual([1, 2]);
  });

  it("unsubscribes via returned function and off()", () => {
    const bus = new EventBus<Events>();
    const received: number[] = [];
    const unsub = bus.on("ping", (n) => received.push(n));
    unsub();
    const handler = (n: number) => received.push(n * 10);
    bus.on("ping", handler);
    bus.off("ping", handler);
    bus.emit("ping", 1);
    expect(received).toEqual([]);
  });

  it("tolerates unsubscribe during emit", () => {
    const bus = new EventBus<Events>();
    const received: string[] = [];
    const unsubA = bus.on("ping", () => {
      received.push("a");
      unsubA();
    });
    bus.on("ping", () => received.push("b"));
    bus.emit("ping", 0);
    bus.emit("ping", 0);
    expect(received).toEqual(["a", "b", "b"]);
  });

  it("clear() removes everything", () => {
    const bus = new EventBus<Events>();
    let count = 0;
    bus.on("ping", () => count++);
    bus.clear();
    bus.emit("ping", 0);
    expect(count).toBe(0);
  });
});
