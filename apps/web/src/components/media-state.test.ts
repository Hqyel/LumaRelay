import { describe, expect, it } from "vitest";

import { ApiError } from "../api.js";
import { mediaErrorPresentation } from "./media-state-model.js";

describe("media error presentation", () => {
  it("separates access denial from retryable upstream failures", () => {
    const denied = mediaErrorPresentation(
      new ApiError("ACCESS_DENIED", "Forbidden", "request-denied", 403),
      "电影库",
    );
    const offline = mediaErrorPresentation(
      new ApiError("HTTP_ERROR", "Unavailable", "request-offline", 503),
      "电影库",
    );

    expect(denied).toMatchObject({
      retryable: false,
      title: "无权访问电影库",
      type: "access-denied",
    });
    expect(denied.description).toContain("request-denied");
    expect(offline).toMatchObject({
      retryable: true,
      title: "电影库暂时不可用",
      type: "offline",
    });
  });

  it("renders missing media without a misleading retry action", () => {
    expect(
      mediaErrorPresentation(
        new ApiError("MEDIA_NOT_FOUND", "Missing", "request-missing", 404),
        "媒体详情",
      ),
    ).toMatchObject({
      retryable: false,
      title: "媒体详情不存在",
      type: "not-found",
    });
  });
});
