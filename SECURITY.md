# Security Policy

## Supported versions

LumaRelay is currently in release-candidate development. Security fixes are
applied to the latest release and the `main` branch.

## Reporting a vulnerability

Do not disclose credentials, server addresses, access tokens, database contents,
or exploit details in a public issue.

Use the repository's **Security → Report a vulnerability** form to open a
private security advisory. Include affected versions, reproduction steps, and
the expected impact, but replace all real Emby addresses and accounts with
reserved examples.

## Deployment baseline

- Terminate public traffic with HTTPS.
- Use independent random values for `LUMARELAY_SESSION_SECRET` and
  `LUMARELAY_TOKEN_ENCRYPTION_KEY`.
- Restrict Emby and Bridge origins to exact trusted values.
- Keep the Gateway database and Player Bridge credential store private.
- Never expose the Player Bridge loopback service to the network.
