import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  players: defineTable({
    userId: v.optional(v.id("users")),
    name: v.string(),
    isOnline: v.boolean(),
    lastSeen: v.number(),
  }).index("by_user", ["userId"])
    .index("by_online", ["isOnline"]),

  duels: defineTable({
    player1Id: v.id("players"),
    player2Id: v.id("players"),
    status: v.union(v.literal("pending"), v.literal("active"), v.literal("completed")),
    winnerId: v.optional(v.id("players")),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  }).index("by_player1", ["player1Id"])
    .index("by_player2", ["player2Id"])
    .index("by_status", ["status"]),

  gameStates: defineTable({
    duelId: v.id("duels"),
    player1Energy: v.number(),
    player2Energy: v.number(),
    player1Timer: v.number(),
    player2Timer: v.number(),
    lastEnergyUpdate: v.number(),
    lastTimerUpdate: v.number(),
    currentTurn: v.optional(v.id("players")),
    grid: v.array(v.array(v.object({
      owner: v.optional(v.id("players")),
      type: v.union(v.literal("neutral"), v.literal("basic"), v.literal("hardened"), v.literal("generator"), v.literal("zapper")),
      purchasedAt: v.optional(v.number()),
      lastZapTime: v.optional(v.number()),
    }))),
  }).index("by_duel", ["duelId"]),

  cellTypes: defineTable({
    name: v.string(),
    baseCost: v.number(),
    energyGeneration: v.number(),
    description: v.string(),
    color: v.string(),
  }),

  invitations: defineTable({
    fromPlayerId: v.id("players"),
    toPlayerId: v.id("players"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined")),
    createdAt: v.number(),
  }).index("by_to_player", ["toPlayerId"])
    .index("by_from_player", ["fromPlayerId"])
    .index("by_status", ["status"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
