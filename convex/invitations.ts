import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const sendInvitation = mutation({
  args: { 
    fromPlayerId: v.id("players"), 
    toPlayerId: v.id("players") 
  },
  handler: async (ctx, args) => {
    // Check if invitation already exists
    const existingInvitation = await ctx.db
      .query("invitations")
      .withIndex("by_to_player", (q) => q.eq("toPlayerId", args.toPlayerId))
      .filter((q) => q.eq(q.field("fromPlayerId"), args.fromPlayerId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingInvitation) {
      throw new Error("Invitation already sent");
    }

    return await ctx.db.insert("invitations", {
      fromPlayerId: args.fromPlayerId,
      toPlayerId: args.toPlayerId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const getInvitations = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_to_player", (q) => q.eq("toPlayerId", args.playerId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    const invitationsWithPlayers = await Promise.all(
      invitations.map(async (invitation) => {
        const fromPlayer = await ctx.db.get(invitation.fromPlayerId);
        return {
          ...invitation,
          fromPlayer,
        };
      })
    );

    return invitationsWithPlayers;
  },
});

export const respondToInvitation = mutation({
  args: { 
    invitationId: v.id("invitations"), 
    accept: v.boolean() 
  },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    await ctx.db.patch(args.invitationId, {
      status: args.accept ? "accepted" : "declined",
    });

    if (args.accept) {
      // Create a new duel
      const duelId = await ctx.db.insert("duels", {
        player1Id: invitation.fromPlayerId,
        player2Id: invitation.toPlayerId,
        status: "active",
        createdAt: Date.now(),
        startedAt: Date.now(),
      });

      // Initialize game state
      const grid = Array(10).fill(null).map(() => 
        Array(10).fill(null).map(() => ({
          type: "neutral" as const,
        }))
      );

      // Set starting positions with basic cells
      (grid[0][4] as any) = { owner: invitation.fromPlayerId, type: "basic", purchasedAt: Date.now() };
      (grid[9][5] as any) = { owner: invitation.toPlayerId, type: "basic", purchasedAt: Date.now() };

      await ctx.db.insert("gameStates", {
        duelId,
        player1Energy: 0,
        player2Energy: 0,
        player1Timer: 20000, // 20 seconds in milliseconds
        player2Timer: 20000,
        lastEnergyUpdate: Date.now(),
        lastTimerUpdate: Date.now(),
        grid,
      });

      return duelId;
    }

    return null;
  },
});
