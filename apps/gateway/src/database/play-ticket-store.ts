import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import {
  PLAY_TICKET_LIFETIME_SECONDS,
  PlayTicketSchema,
  type PlayTicketSelection,
} from "@newemby/contracts";
import type { Kysely } from "kysely";

import type { GatewayConfig } from "../config.js";
import type { DatabaseSchema } from "./types.js";

const PLAY_TICKET_LIFETIME_MS = PLAY_TICKET_LIFETIME_SECONDS * 1000;

export interface IssuePlayTicketInput {
  authSessionId: string;
  bridgeDeviceId: string;
  selection: PlayTicketSelection;
  serverId: string;
  userId: string;
}

export interface IssuedPlayTicket {
  expiresAt: string;
  playSessionId: string;
  playTicket: string;
}

export interface RedeemedPlayTicket {
  playSessionId: string;
  selection: PlayTicketSelection;
}

export interface StoredPlaybackSession {
  authSessionId: string;
  bridgeDeviceId: string;
  playSessionId: string;
  selection: PlayTicketSelection;
  serverId: string;
  startedAt: string | null;
  userId: string;
}

export interface PlayTicketStore {
  findPlaybackSession?(
    playSessionId: string,
    bridgeDeviceId: string,
  ): Promise<StoredPlaybackSession | null>;
  issue(input: IssuePlayTicketInput): Promise<IssuedPlayTicket | null>;
  markStarted?(playSessionId: string, startedAt: string): Promise<void>;
  markStopped?(
    playSessionId: string,
    positionTicks: number,
    stoppedAt: string,
  ): Promise<void>;
  markProgress?(
    playSessionId: string,
    positionTicks: number,
    eventAt: string,
    audioStreamIndex?: number | null,
    subtitleStreamIndex?: number | null,
  ): Promise<void>;
  pruneInactive(): Promise<number>;
  redeem(
    playTicket: string,
    bridgeDeviceId: string,
  ): Promise<RedeemedPlayTicket | null>;
}

export interface PlayTicketRandomSource {
  id(): string;
  secret(): string;
}

function hashPlayTicketSecret(value: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("newemby:play-ticket-secret:")
    .update(value)
    .digest("hex");
}

function sameHash(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.byteLength === rightBuffer.byteLength &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function parsePlayTicket(value: string): { id: string; secret: string } | null {
  if (!PlayTicketSchema.safeParse(value).success) return null;
  const [, id, secret] = value.split(".");
  if (id === undefined || secret === undefined) return null;
  return { id, secret };
}

const defaultRandomSource: PlayTicketRandomSource = {
  id: randomUUID,
  secret: () => randomBytes(32).toString("base64url"),
};

export function createPlayTicketStore(
  database: Kysely<DatabaseSchema>,
  config: Pick<GatewayConfig, "sessionSecret">,
  now: () => Date = () => new Date(),
  random: PlayTicketRandomSource = defaultRandomSource,
): PlayTicketStore {
  return {
    async findPlaybackSession(
      playSessionId: string,
      bridgeDeviceId: string,
    ): Promise<StoredPlaybackSession | null> {
      const session = await database
        .selectFrom("playbackSessions")
        .selectAll()
        .where("id", "=", playSessionId)
        .where("bridgeDeviceId", "=", bridgeDeviceId)
        .where("stoppedAt", "is", null)
        .executeTakeFirst();
      if (session === undefined) return null;

      return {
        authSessionId: session.authSessionId,
        bridgeDeviceId: session.bridgeDeviceId,
        playSessionId: session.id,
        selection: {
          audioStreamIndex: session.audioStreamIndex,
          itemId: session.embyItemId,
          mediaSourceId: session.mediaSourceId,
          resumeTicks: session.resumeTicks,
          subtitleStreamIndex: session.subtitleStreamIndex,
        },
        serverId: session.serverId,
        startedAt: session.startedAt,
        userId: session.embyUserId,
      };
    },
    async issue(input: IssuePlayTicketInput): Promise<IssuedPlayTicket | null> {
      return database.transaction().execute(async (transaction) => {
        const createdAt = now();
        const createdAtIso = createdAt.toISOString();
        await transaction
          .deleteFrom("playTickets")
          .where("expiresAt", "<=", createdAtIso)
          .execute();

        const binding = await transaction
          .selectFrom("authSessions")
          .innerJoin(
            "bridgeDevices",
            "bridgeDevices.serverId",
            "authSessions.serverId",
          )
          .select("authSessions.id")
          .where("authSessions.id", "=", input.authSessionId)
          .where("authSessions.serverId", "=", input.serverId)
          .where("authSessions.embyUserId", "=", input.userId)
          .where("authSessions.revokedAt", "is", null)
          .where("authSessions.expiresAt", ">", createdAtIso)
          .where("bridgeDevices.id", "=", input.bridgeDeviceId)
          .where("bridgeDevices.embyUserId", "=", input.userId)
          .where("bridgeDevices.revokedAt", "is", null)
          .executeTakeFirst();
        if (binding === undefined) return null;

        const ticketId = random.id();
        const playSessionId = random.id();
        const ticketSecret = random.secret();
        const expiresAt = new Date(
          createdAt.getTime() + PLAY_TICKET_LIFETIME_MS,
        );
        await transaction
          .insertInto("playTickets")
          .values({
            audioStreamIndex: input.selection.audioStreamIndex,
            authSessionId: input.authSessionId,
            bridgeDeviceId: input.bridgeDeviceId,
            createdAt: createdAtIso,
            embyItemId: input.selection.itemId,
            embyUserId: input.userId,
            expiresAt: expiresAt.toISOString(),
            id: ticketId,
            mediaSourceId: input.selection.mediaSourceId,
            playSessionId,
            redeemedAt: null,
            resumeTicks: input.selection.resumeTicks,
            secretHash: hashPlayTicketSecret(
              ticketSecret,
              config.sessionSecret,
            ),
            serverId: input.serverId,
            subtitleStreamIndex: input.selection.subtitleStreamIndex,
          })
          .execute();

        return {
          expiresAt: expiresAt.toISOString(),
          playSessionId,
          playTicket: `pt1.${ticketId}.${ticketSecret}`,
        };
      });
    },

    async markStarted(playSessionId: string, startedAt: string): Promise<void> {
      await database
        .updateTable("playbackSessions")
        .set({
          lastEventAt: startedAt,
          startedAt,
        })
        .where("id", "=", playSessionId)
        .where("startedAt", "is", null)
        .execute();
    },

    async markStopped(
      playSessionId: string,
      positionTicks: number,
      stoppedAt: string,
    ): Promise<void> {
      await database
        .updateTable("playbackSessions")
        .set({
          lastEventAt: stoppedAt,
          lastPositionTicks: positionTicks,
          stoppedAt,
        })
        .where("id", "=", playSessionId)
        .where("startedAt", "is not", null)
        .where("stoppedAt", "is", null)
        .execute();
    },

    async markProgress(
      playSessionId: string,
      positionTicks: number,
      eventAt: string,
      audioStreamIndex?: number | null,
      subtitleStreamIndex?: number | null,
    ): Promise<void> {
      const update: {
        audioStreamIndex?: number | null;
        lastEventAt: string;
        lastPositionTicks: number;
        subtitleStreamIndex?: number | null;
      } = { lastEventAt: eventAt, lastPositionTicks: positionTicks };
      if (audioStreamIndex !== undefined)
        update.audioStreamIndex = audioStreamIndex;
      if (subtitleStreamIndex !== undefined)
        update.subtitleStreamIndex = subtitleStreamIndex;

      await database
        .updateTable("playbackSessions")
        .set(update)
        .where("id", "=", playSessionId)
        .where("startedAt", "is not", null)
        .where("stoppedAt", "is", null)
        .execute();
    },

    async pruneInactive(): Promise<number> {
      const result = await database
        .deleteFrom("playTickets")
        .where("expiresAt", "<=", now().toISOString())
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    },

    async redeem(
      playTicket: string,
      bridgeDeviceId: string,
    ): Promise<RedeemedPlayTicket | null> {
      const parsed = parsePlayTicket(playTicket);
      if (parsed === null) return null;

      return database.transaction().execute(async (transaction) => {
        const redeemedAt = now().toISOString();
        const ticket = await transaction
          .selectFrom("playTickets")
          .selectAll()
          .where("id", "=", parsed.id)
          .executeTakeFirst();
        if (
          ticket === undefined ||
          ticket.bridgeDeviceId !== bridgeDeviceId ||
          ticket.redeemedAt !== null ||
          ticket.expiresAt <= redeemedAt ||
          !sameHash(
            ticket.secretHash,
            hashPlayTicketSecret(parsed.secret, config.sessionSecret),
          )
        ) {
          return null;
        }

        const binding = await transaction
          .selectFrom("authSessions")
          .innerJoin(
            "bridgeDevices",
            "bridgeDevices.serverId",
            "authSessions.serverId",
          )
          .select("authSessions.id")
          .where("authSessions.id", "=", ticket.authSessionId)
          .where("authSessions.serverId", "=", ticket.serverId)
          .where("authSessions.embyUserId", "=", ticket.embyUserId)
          .where("authSessions.revokedAt", "is", null)
          .where("authSessions.expiresAt", ">", redeemedAt)
          .where("bridgeDevices.id", "=", ticket.bridgeDeviceId)
          .where("bridgeDevices.serverId", "=", ticket.serverId)
          .where("bridgeDevices.embyUserId", "=", ticket.embyUserId)
          .where("bridgeDevices.revokedAt", "is", null)
          .executeTakeFirst();
        if (binding === undefined) return null;

        const consumed = await transaction
          .updateTable("playTickets")
          .set({ redeemedAt })
          .where("id", "=", ticket.id)
          .where("bridgeDeviceId", "=", bridgeDeviceId)
          .where("redeemedAt", "is", null)
          .where("expiresAt", ">", redeemedAt)
          .executeTakeFirst();
        if (Number(consumed.numUpdatedRows) !== 1) return null;

        await transaction
          .insertInto("playbackSessions")
          .values({
            audioStreamIndex: ticket.audioStreamIndex,
            authSessionId: ticket.authSessionId,
            bridgeDeviceId: ticket.bridgeDeviceId,
            createdAt: redeemedAt,
            embyItemId: ticket.embyItemId,
            embyUserId: ticket.embyUserId,
            id: ticket.playSessionId,
            lastEventAt: null,
            lastPositionTicks: ticket.resumeTicks,
            lastSequence: 0,
            mediaSourceId: ticket.mediaSourceId,
            resumeTicks: ticket.resumeTicks,
            serverId: ticket.serverId,
            startedAt: null,
            stoppedAt: null,
            subtitleStreamIndex: ticket.subtitleStreamIndex,
          })
          .execute();

        return {
          playSessionId: ticket.playSessionId,
          selection: {
            audioStreamIndex: ticket.audioStreamIndex,
            itemId: ticket.embyItemId,
            mediaSourceId: ticket.mediaSourceId,
            resumeTicks: ticket.resumeTicks,
            subtitleStreamIndex: ticket.subtitleStreamIndex,
          },
        };
      });
    },
  };
}
