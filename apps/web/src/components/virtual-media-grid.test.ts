import { describe, expect, it } from "vitest";

import {
  mediaGridColumnCount,
  mediaGridRowCount,
} from "./media-grid-layout.js";

describe("virtual media grid layout", () => {
  it("uses two columns on compact screens", () => {
    expect(mediaGridColumnCount(340, 639)).toBe(2);
  });

  it("derives desktop columns from the minimum card width and gap", () => {
    expect(mediaGridColumnCount(880, 1280)).toBe(5);
    expect(mediaGridColumnCount(160, 1280)).toBe(1);
  });

  it("groups items into complete and partial rows", () => {
    expect(mediaGridRowCount(100, 5)).toBe(20);
    expect(mediaGridRowCount(8, 5)).toBe(2);
    expect(mediaGridRowCount(0, 5)).toBe(0);
  });
});
