import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getCurrentPlayer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const player = await ctx.db
      .query("players")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return player;
  },
});

export const getOrCreatePlayer = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    let player;
    if (userId) {
      player = await ctx.db
        .query("players")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
    }

    if (!player) {
      const playerId = await ctx.db.insert("players", {
        userId: userId || undefined,
        name: args.name,
        isOnline: true,
        lastSeen: Date.now(),
      });
      player = await ctx.db.get(playerId);
    } else {
      await ctx.db.patch(player._id, {
        isOnline: true,
        lastSeen: Date.now(),
      });
    }

    return player;
  },
});

export const updatePlayerStatus = mutation({
  args: { playerId: v.id("players"), isOnline: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.playerId, {
      isOnline: args.isOnline,
      lastSeen: Date.now(),
    });
  },
});

export const getOnlinePlayers = query({
  args: {},
  handler: async (ctx) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_online", (q) => q.eq("isOnline", true))
      .collect();

    // Filter out players who haven't been seen in the last 50 seconds
    const fiveMinutesAgo = Date.now() - 50 * 1000;
    return players.filter(player => player.lastSeen > fiveMinutesAgo);
  },
});
