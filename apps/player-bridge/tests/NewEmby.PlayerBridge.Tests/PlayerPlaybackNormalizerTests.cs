using NewEmby.PlayerBridge.MediaSessions;

namespace NewEmby.PlayerBridge.Tests;

public sealed class PlayerPlaybackNormalizerTests
{
  private static readonly Guid PlaySessionId = Guid.Parse(
    "33333333-3333-4333-8333-333333333333");
  private static readonly DateTimeOffset UpdatedAt = new(
    2026,
    7,
    22,
    11,
    0,
    0,
    TimeSpan.Zero);

  [Fact]
  public void NormalizesTimelineRelativeToItsStartAndClampsRanges()
  {
    var snapshot = Normalize(
      SmtcPlaybackState.Playing,
      Timeline(
        start: Seconds(10),
        end: Seconds(70),
        position: Seconds(40),
        minimumSeek: Seconds(5),
        maximumSeek: Seconds(80)));

    Assert.Equal(PlayerPlaybackState.Playing, snapshot.State);
    Assert.Equal(Seconds(30), snapshot.PositionTicks);
    Assert.Equal(Seconds(60), snapshot.DurationTicks);
    Assert.Equal(0, snapshot.MinimumSeekTicks);
    Assert.Equal(Seconds(60), snapshot.MaximumSeekTicks);
    Assert.Equal(UpdatedAt, snapshot.TimelineUpdatedAt);
    Assert.Equal(1, snapshot.PlaybackRate);
    Assert.False(snapshot.HasSeeked);
    Assert.False(snapshot.IsTimelineStale);
  }

  [Fact]
  public void MapsAllPlaybackStates()
  {
    var cases = new[]
    {
      (SmtcPlaybackState.Closed, PlayerPlaybackState.Closed),
      (SmtcPlaybackState.Opened, PlayerPlaybackState.Opened),
      (SmtcPlaybackState.Changing, PlayerPlaybackState.Changing),
      (SmtcPlaybackState.Stopped, PlayerPlaybackState.Stopped),
      (SmtcPlaybackState.Playing, PlayerPlaybackState.Playing),
      (SmtcPlaybackState.Paused, PlayerPlaybackState.Paused),
      (SmtcPlaybackState.Unknown, PlayerPlaybackState.Unknown),
    };

    foreach (var (source, expected) in cases)
      Assert.Equal(expected, Normalize(source, Timeline()).State);
  }

  [Fact]
  public void DistinguishesNormalProgressFromASeek()
  {
    var previous = Normalize(
      SmtcPlaybackState.Playing,
      Timeline(position: Seconds(10)));
    var normal = PlayerPlaybackNormalizer.Normalize(
      PlaySessionId,
      new SmtcPlaybackInfo(SmtcPlaybackState.Playing, 1),
      Timeline(
        position: Seconds(11),
        updatedAt: UpdatedAt.AddSeconds(1)),
      previous,
      UpdatedAt.AddSeconds(1));
    var seeked = PlayerPlaybackNormalizer.Normalize(
      PlaySessionId,
      new SmtcPlaybackInfo(SmtcPlaybackState.Playing, 1),
      Timeline(
        position: Seconds(35),
        updatedAt: UpdatedAt.AddSeconds(2)),
      normal,
      UpdatedAt.AddSeconds(2));

    Assert.False(normal.HasSeeked);
    Assert.True(seeked.HasSeeked);
  }

  [Fact]
  public void DetectsASeekWhilePaused()
  {
    var previous = Normalize(
      SmtcPlaybackState.Paused,
      Timeline(position: Seconds(10)));

    var current = PlayerPlaybackNormalizer.Normalize(
      PlaySessionId,
      new SmtcPlaybackInfo(SmtcPlaybackState.Paused, 1),
      Timeline(
        position: Seconds(30),
        updatedAt: UpdatedAt.AddSeconds(1)),
      previous,
      UpdatedAt.AddSeconds(1));

    Assert.Equal(PlayerPlaybackState.Paused, current.State);
    Assert.True(current.HasSeeked);
  }

  [Fact]
  public void MarksTerminalPlaybackNearTheEndAsEnded()
  {
    var snapshot = Normalize(
      SmtcPlaybackState.Stopped,
      Timeline(position: Seconds(59)));

    Assert.Equal(PlayerPlaybackState.Ended, snapshot.State);
    Assert.Equal(Seconds(59), snapshot.PositionTicks);
  }

  [Fact]
  public void PreservesTheEndWhenPotPlayerResetsItsTimeline()
  {
    var previous = Normalize(
      SmtcPlaybackState.Playing,
      Timeline(position: Seconds(59)));

    var ended = PlayerPlaybackNormalizer.Normalize(
      PlaySessionId,
      new SmtcPlaybackInfo(SmtcPlaybackState.Playing, 1),
      Timeline(
        end: 0,
        position: 0,
        maximumSeek: 0,
        updatedAt: UpdatedAt.AddSeconds(1)),
      previous,
      UpdatedAt.AddSeconds(1));

    Assert.Equal(PlayerPlaybackState.Ended, ended.State);
    Assert.Equal(Seconds(60), ended.DurationTicks);
    Assert.Equal(Seconds(60), ended.PositionTicks);
    Assert.False(ended.HasSeeked);
  }

  [Fact]
  public void FlagsAPlayingTimelineThatStopsUpdating()
  {
    var stale = PlayerPlaybackNormalizer.Normalize(
      PlaySessionId,
      new SmtcPlaybackInfo(SmtcPlaybackState.Playing, 1),
      Timeline(),
      null,
      UpdatedAt.AddSeconds(6));
    var paused = PlayerPlaybackNormalizer.Normalize(
      PlaySessionId,
      new SmtcPlaybackInfo(SmtcPlaybackState.Paused, 1),
      Timeline(),
      null,
      UpdatedAt.AddMinutes(1));

    Assert.True(stale.IsTimelineStale);
    Assert.False(paused.IsTimelineStale);
  }

  [Fact]
  public void HandlesExtremeAndInvalidTimelineValuesWithoutOverflow()
  {
    var snapshot = Normalize(
      SmtcPlaybackState.Playing,
      Timeline(
        start: long.MinValue,
        end: long.MaxValue,
        position: long.MaxValue,
        minimumSeek: long.MinValue,
        maximumSeek: long.MaxValue));

    Assert.Equal(long.MaxValue, snapshot.DurationTicks);
    Assert.Equal(long.MaxValue, snapshot.PositionTicks);
    Assert.Equal(0, snapshot.MinimumSeekTicks);
    Assert.Equal(long.MaxValue, snapshot.MaximumSeekTicks);
  }

  private static PlayerPlaybackSnapshot Normalize(
    SmtcPlaybackState state,
    SmtcTimelineProperties timeline)
  {
    return PlayerPlaybackNormalizer.Normalize(
      PlaySessionId,
      new SmtcPlaybackInfo(state, 1),
      timeline,
      null,
      UpdatedAt);
  }

  private static SmtcTimelineProperties Timeline(
    long start = 0,
    long? end = null,
    long? position = null,
    long minimumSeek = 0,
    long? maximumSeek = null,
    DateTimeOffset? updatedAt = null)
  {
    return new SmtcTimelineProperties(
      start,
      end ?? Seconds(60),
      position ?? Seconds(20),
      minimumSeek,
      maximumSeek ?? Seconds(60),
      updatedAt ?? UpdatedAt);
  }

  private static long Seconds(int value)
  {
    return TimeSpan.FromSeconds(value).Ticks;
  }
}
