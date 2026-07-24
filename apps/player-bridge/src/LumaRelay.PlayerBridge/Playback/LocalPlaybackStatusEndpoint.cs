using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using LumaRelay.PlayerBridge.MediaSessions;
using LumaRelay.PlayerBridge.Security;

namespace LumaRelay.PlayerBridge.Playback;

internal static class LocalPlaybackStatusEndpoint
{
  public static void Map(
    WebApplication application,
    BridgeRequestSecurity security,
    LocalPlaybackSessionStore sessionStore,
    IPotPlayerSessionMatcher sessionMatcher,
    IPotPlayerPlaybackMonitor playbackMonitor)
  {
    application.MapGet("/v1/playback/status", async context =>
    {
      context.Response.Headers.CacheControl = "no-store";
      if (!await security.AuthorizeReadAsync(context))
        return;

      var sessions = sessionStore.List()
        .Select(session => CreateStatus(
          session,
          sessionMatcher,
          playbackMonitor))
        .ToArray();
      await context.Response.WriteAsJsonAsync(new { sessions });
    });
  }

  internal static LocalPlaybackStatus CreateStatus(
    LocalPlaybackSession session,
    IPotPlayerSessionMatcher sessionMatcher,
    IPotPlayerPlaybackMonitor playbackMonitor)
  {
    var match = sessionMatcher.Snapshot.Matches.FirstOrDefault(candidate =>
      candidate.PlaySessionId == session.PlaySessionId);
    playbackMonitor.TryGetSnapshot(
      session.PlaySessionId,
      out var playback);

    var matchExpired = playback is null
      && match is null
      && DateTimeOffset.UtcNow - session.CreatedAt >= TimeSpan.FromSeconds(15);
    var state = PlaybackState(playback, match, matchExpired);
    var syncState = SyncState(playback, match, matchExpired);
    var warning = Warning(playback, match, matchExpired);
    var updatedAt = playback?.ObservedAt
      ?? match?.UpdatedAt
      ?? session.CreatedAt;
    return new LocalPlaybackStatus(
      session.PlaySessionId,
      session.Selection.ItemId,
      state,
      syncState,
      Math.Max(0, playback?.PositionTicks ?? session.Selection.ResumeTicks),
      Math.Max(0, playback?.DurationTicks ?? 0),
      updatedAt,
      warning);
  }

  private static string PlaybackState(
    PlayerPlaybackSnapshot? playback,
    PlayerSessionMatch? match,
    bool matchExpired)
  {
    if (playback is not null)
    {
      return playback.State switch
      {
        PlayerPlaybackState.Playing => "playing",
        PlayerPlaybackState.Paused => "paused",
        PlayerPlaybackState.Ended => "ended",
        PlayerPlaybackState.Stopped or PlayerPlaybackState.Closed =>
          "stopped",
        _ => "launching",
      };
    }

    return matchExpired || match?.State is PlayerSessionMatchState.Ambiguous
      or PlayerSessionMatchState.ProcessExited
      or PlayerSessionMatchState.TimedOut
        ? "unavailable"
        : "launching";
  }

  private static string SyncState(
    PlayerPlaybackSnapshot? playback,
    PlayerSessionMatch? match,
    bool matchExpired)
  {
    if (playback?.IsTimelineStale is true)
      return "stale";
    if (playback is not null)
      return "synchronized";
    return matchExpired || match?.State is PlayerSessionMatchState.Ambiguous
      or PlayerSessionMatchState.ProcessExited
      or PlayerSessionMatchState.TimedOut
        ? "unavailable"
        : "waiting";
  }

  private static string? Warning(
    PlayerPlaybackSnapshot? playback,
    PlayerSessionMatch? match,
    bool matchExpired)
  {
    if (playback?.IsTimelineStale is true)
      return "SMTC_STALE";
    if (matchExpired)
      return "SMTC_MATCH_TIMEOUT";
    return match?.State switch
    {
      PlayerSessionMatchState.Ambiguous => "SMTC_AMBIGUOUS",
      PlayerSessionMatchState.ProcessExited => "PLAYER_EXITED",
      PlayerSessionMatchState.TimedOut => "SMTC_MATCH_TIMEOUT",
      PlayerSessionMatchState.Awaiting => "SMTC_NOT_MATCHED",
      _ => null,
    };
  }
}

internal sealed record LocalPlaybackStatus(
  Guid PlaySessionId,
  string ItemId,
  string State,
  string SyncState,
  long PositionTicks,
  long DurationTicks,
  DateTimeOffset UpdatedAt,
  string? Warning);
