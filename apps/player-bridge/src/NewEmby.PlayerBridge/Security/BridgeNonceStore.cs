using System.Text.RegularExpressions;

namespace NewEmby.PlayerBridge.Security;

internal enum NonceUseResult
{
  Accepted,
  Invalid,
  Replay,
}

internal sealed partial class BridgeNonceStore(
  Func<DateTimeOffset>? now = null)
{
  private const int MaximumNonceCount = 4096;
  private static readonly TimeSpan NonceLifetime = TimeSpan.FromMinutes(5);
  private readonly object gate = new();
  private readonly Dictionary<string, DateTimeOffset> nonces = [];
  private readonly Func<DateTimeOffset> currentTime =
    now ?? (() => DateTimeOffset.UtcNow);

  public NonceUseResult TryUse(string? nonce)
  {
    if (string.IsNullOrWhiteSpace(nonce)
        || !NoncePattern().IsMatch(nonce))
    {
      return NonceUseResult.Invalid;
    }

    lock (gate)
    {
      var usedAt = currentTime();
      foreach (var expired in nonces
        .Where(entry => entry.Value <= usedAt)
        .Select(entry => entry.Key)
        .ToArray())
      {
        nonces.Remove(expired);
      }

      if (nonces.ContainsKey(nonce))
        return NonceUseResult.Replay;

      if (nonces.Count >= MaximumNonceCount)
      {
        var oldest = nonces.MinBy(entry => entry.Value);
        nonces.Remove(oldest.Key);
      }

      nonces.Add(nonce, usedAt.Add(NonceLifetime));
      return NonceUseResult.Accepted;
    }
  }

  [GeneratedRegex(
    "^[A-Za-z0-9_-]{22,128}$",
    RegexOptions.CultureInvariant)]
  private static partial Regex NoncePattern();
}
