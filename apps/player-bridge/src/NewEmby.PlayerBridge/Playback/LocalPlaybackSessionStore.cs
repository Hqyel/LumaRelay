using System.Collections.Concurrent;

namespace NewEmby.PlayerBridge.Playback;

internal sealed record LocalPlaybackSelection(
  string ItemId,
  string MediaSourceId,
  long ResumeTicks,
  int? AudioStreamIndex,
  int? SubtitleStreamIndex);

internal sealed record LocalPlaybackSession(
  Guid PlaySessionId,
  LocalPlaybackSelection Selection);

internal sealed class LocalPlaybackSessionStore
{
  private readonly ConcurrentDictionary<Guid, LocalPlaybackSession> sessions =
    new();

  public void Add(LocalPlaybackSession session)
  {
    sessions[session.PlaySessionId] = session;
  }

  public bool Remove(Guid playSessionId)
  {
    return sessions.TryRemove(playSessionId, out _);
  }

  public bool TryGet(Guid playSessionId, out LocalPlaybackSession session)
  {
    return sessions.TryGetValue(playSessionId, out session!);
  }
}
