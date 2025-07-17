import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getActiveDuel = query({
  args: { playerId: v.id("players") },
  handler: async (ctx, args) => {
    const duel = await ctx.db
      .query("duels")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => 
        q.or(
          q.eq(q.field("player1Id"), args.playerId),
          q.eq(q.field("player2Id"), args.playerId)
        )
      )
      .first();

    if (!duel) return null;

    const gameState = await ctx.db
      .query("gameStates")
      .withIndex("by_duel", (q) => q.eq("duelId", duel._id))
      .first();

    const player1 = await ctx.db.get(duel.player1Id);
    const player2 = await ctx.db.get(duel.player2Id);

    return {
      duel,
      gameState,
      player1,
      player2,
    };
  },
});

export const updateGameState = mutation({
  args: {
    duelId: v.id("duels"),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const gameState = await ctx.db
      .query("gameStates")
      .withIndex("by_duel", (q) => q.eq("duelId", args.duelId))
      .first();

    if (!gameState) {
      throw new Error("Game state not found");
    }

    const duel = await ctx.db.get(args.duelId);
    if (!duel) {
      throw new Error("Duel not found");
    }

    const now = Date.now();
    const timeDiff = now - gameState.lastEnergyUpdate;
    const timerDiff = now - gameState.lastTimerUpdate;
    
    // Calculate energy generation and handle special cell mechanics
    let player1Energy = gameState.player1Energy;
    let player2Energy = gameState.player2Energy;
    let gridChanged = false;

    // Process grid for energy generation, generator expiration, and zapper actions
    const newGrid = gameState.grid.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        // Handle generator cell expiration
        if (cell.type === "generator" && cell.purchasedAt) {
          const cellAge = now - cell.purchasedAt;
          if (cellAge >= 20000) { // 20 seconds
            gridChanged = true;
            return { type: "neutral" as const };
          }
        }

        // Handle zapper cell actions (every 5 seconds)
        if (cell.type === "zapper" && cell.owner && cell.purchasedAt) {
          const timeSinceLastZap = cell.lastZapTime ? now - cell.lastZapTime : now - cell.purchasedAt;
          if (timeSinceLastZap >= 5000) { // 5 seconds
            // Zapper will be processed after this loop
            return { ...cell, lastZapTime: now };
          }
        }

        return cell;
      })
    );

    // Process zapper actions
    for (let row = 0; row < newGrid.length; row++) {
      for (let col = 0; col < newGrid[row].length; col++) {
        const cell = newGrid[row][col];
        if (cell.type === "zapper" && cell.owner && cell.lastZapTime === now) {
          const zapResult = processZapperAction(newGrid, row, col, cell.owner);
          if (zapResult.gridChanged) {
            gridChanged = true;
            // Apply the zap result to the grid
            if (zapResult.targetRow !== undefined && zapResult.targetCol !== undefined) {
              newGrid[zapResult.targetRow][zapResult.targetCol] = zapResult.newCell!;
            }
          }
        }
      }
    }

    // Count owned cells and calculate energy generation with exponential generator scaling
    let player1Cells = 0;
    let player2Cells = 0;
    let player1EnergyRate = 0;
    let player2EnergyRate = 0;
    let player1Generators = 0;
    let player2Generators = 0;
    
    for (const row of newGrid) {
      for (const cell of row) {
        if (cell.owner === duel.player1Id) {
          player1Cells++;
          if (cell.type === "basic") {
            player1EnergyRate += 10;
          } else if (cell.type === "hardened") {
            player1EnergyRate += 40;
          } else if (cell.type === "generator") {
            player1Generators++;
          } else if (cell.type === "zapper") {
            player1EnergyRate += 30;
          }
        } else if (cell.owner === duel.player2Id) {
          player2Cells++;
          if (cell.type === "basic") {
            player2EnergyRate += 10;
          } else if (cell.type === "hardened") {
            player2EnergyRate += 40;
          } else if (cell.type === "generator") {
            player2Generators++;
          } else if (cell.type === "zapper") {
            player2EnergyRate += 30;
          }
        }
      }
    }

    // Apply exponential generator scaling
    if (player1Generators > 0) {
      const generatorMultiplier = Math.pow(1.5, player1Generators - 1);
      player1EnergyRate += Math.floor(50 * player1Generators * generatorMultiplier);
    }
    if (player2Generators > 0) {
      const generatorMultiplier = Math.pow(1.5, player2Generators - 1);
      player2EnergyRate += Math.floor(50 * player2Generators * generatorMultiplier);
    }

    // Generate energy
    const energyPerMs1 = player1EnergyRate / 1000;
    const energyPerMs2 = player2EnergyRate / 1000;
    player1Energy += energyPerMs1 * timeDiff;
    player2Energy += energyPerMs2 * timeDiff;

    // Update timers - both count down simultaneously
    let player1Timer = Math.max(0, gameState.player1Timer - timerDiff);
    let player2Timer = Math.max(0, gameState.player2Timer - timerDiff);

    // Check for bankruptcy (timer reached 0)
    let winnerId = null;
    if (player1Timer <= 0 && player2Timer <= 0) {
      // Both bankrupt, player with more cells wins
      winnerId = player1Cells >= player2Cells ? duel.player1Id : duel.player2Id;
    } else if (player1Timer <= 0) {
      winnerId = duel.player2Id;
    } else if (player2Timer <= 0) {
      winnerId = duel.player1Id;
    }

    // Check for disconnection (player hasn't been seen recently)
    const player1 = await ctx.db.get(duel.player1Id);
    const player2 = await ctx.db.get(duel.player2Id);
    const disconnectionThreshold = 2 * 60 * 1000; // 2 minutes

    if (player1 && player2) {
      if (now - player1.lastSeen > disconnectionThreshold) {
        winnerId = duel.player2Id;
      } else if (now - player2.lastSeen > disconnectionThreshold) {
        winnerId = duel.player1Id;
      }
    }

    const updates: any = {
      player1Energy,
      player2Energy,
      player1Timer,
      player2Timer,
      lastEnergyUpdate: now,
      lastTimerUpdate: now,
    };

    if (gridChanged) {
      updates.grid = newGrid;
    }

    await ctx.db.patch(gameState._id, updates);

    // End duel if there's a winner
    if (winnerId) {
      await ctx.db.patch(duel._id, {
        status: "completed" as const,
        winnerId,
        completedAt: now,
      });
    }

    return { 
      player1Energy, 
      player2Energy, 
      player1Timer, 
      player2Timer,
      player1Cells,
      player2Cells,
      player1EnergyRate,
      player2EnergyRate,
      player1Generators,
      player2Generators,
      winnerId,
      gridChanged: gridChanged ? newGrid : undefined
    };
  },
});

function processZapperAction(grid: any[][], zapperRow: number, zapperCol: number, ownerId: any) {
  // Find all cells within 4x4 radius (2 cells in each direction)
  const targets = [];
  for (let row = Math.max(0, zapperRow - 2); row <= Math.min(9, zapperRow + 2); row++) {
    for (let col = Math.max(0, zapperCol - 2); col <= Math.min(9, zapperCol + 2); col++) {
      if (row === zapperRow && col === zapperCol) continue; // Skip the zapper itself
      targets.push({ row, col });
    }
  }

  if (targets.length === 0) {
    return { gridChanged: false };
  }

  // Randomly select a target
  const target = targets[Math.floor(Math.random() * targets.length)];
  const targetCell = grid[target.row][target.col];

  // If friendly cell, convert to generator
  if (targetCell.owner === ownerId) {
    if (targetCell.type !== "generator") {
      return {
        gridChanged: true,
        targetRow: target.row,
        targetCol: target.col,
        newCell: {
          owner: ownerId,
          type: "generator" as const,
          purchasedAt: Date.now(),
        }
      };
    }
  }
  // If enemy cell (not hardened), capture it
  else if (targetCell.owner && targetCell.owner !== ownerId && targetCell.type !== "hardened") {
    return {
      gridChanged: true,
      targetRow: target.row,
      targetCol: target.col,
      newCell: {
        owner: ownerId,
        type: "basic" as const,
        purchasedAt: Date.now(),
      }
    };
  }
  // If neutral cell, capture it
  else if (!targetCell.owner) {
    return {
      gridChanged: true,
      targetRow: target.row,
      targetCol: target.col,
      newCell: {
        owner: ownerId,
        type: "basic" as const,
        purchasedAt: Date.now(),
      }
    };
  }

  return { gridChanged: false };
}

export const purchaseCell = mutation({
  args: {
    duelId: v.id("duels"),
    playerId: v.id("players"),
    row: v.number(),
    col: v.number(),
    cellType: v.optional(v.union(v.literal("basic"), v.literal("hardened"), v.literal("generator"), v.literal("zapper"))),
  },
  handler: async (ctx, args) => {
    const gameState = await ctx.db
      .query("gameStates")
      .withIndex("by_duel", (q) => q.eq("duelId", args.duelId))
      .first();

    if (!gameState) {
      throw new Error("Game not found");
    }

    const duel = await ctx.db.get(args.duelId);
    if (!duel) {
      throw new Error("Game not found");
    }

    if (duel.status !== "active") {
      throw new Error("Game is no longer active");
    }

    const cellType = args.cellType || "basic";

    // Check if cell is valid for purchase
    const cell = gameState.grid[args.row][args.col];
    if (cell.owner === args.playerId) {
      throw new Error("You already own this cell");
    }

    // Check if trying to capture a hardened cell
    if (cell.owner && cell.owner !== args.playerId && cell.type === "hardened") {
      throw new Error("Cannot capture hardened cells");
    }

    // Check adjacency to owned cells (must be adjacent to expand or capture)
    const isAdjacent = checkAdjacency(gameState.grid, args.row, args.col, args.playerId);
    if (!isAdjacent) {
      throw new Error("Must expand from adjacent territory");
    }

    // Calculate cost
    const playerCells = countPlayerCells(gameState.grid, args.playerId);
    let cost: number;
    
    if (cell.owner && cell.owner !== args.playerId) {
      // Capturing enemy cell - costs double the base expansion cost regardless of cell type
      cost = calculateCellCost(playerCells) * 2;
    } else {
      // Expanding to neutral cell
      if (cellType === "hardened") {
        cost = 700 + calculateCellCost(playerCells);
      } else if (cellType === "generator") {
        cost = calculateCellCost(playerCells) + 100;
      } else if (cellType === "zapper") {
        cost = calculateCellCost(playerCells) + 500;
      } else {
        cost = calculateCellCost(playerCells);
      }
    }

    // Check if player has enough energy
    const isPlayer1 = duel.player1Id === args.playerId;
    const playerEnergy = isPlayer1 ? gameState.player1Energy : gameState.player2Energy;

    if (playerEnergy < cost) {
      throw new Error("Insufficient energy");
    }

    // Update grid
    const newGrid = gameState.grid.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (rowIndex === args.row && colIndex === args.col) {
          return {
            owner: args.playerId,
            type: cellType,
            purchasedAt: Date.now(),
          };
        }
        return cell;
      })
    );

    // Update energy and reset timer to 20 seconds
    const newEnergy = playerEnergy - cost;
    const updates: any = {
      grid: newGrid,
      lastTimerUpdate: Date.now(),
    };

    if (isPlayer1) {
      updates.player1Energy = newEnergy;
      updates.player1Timer = 20000; // 20 seconds
    } else {
      updates.player2Energy = newEnergy;
      updates.player2Timer = 20000; // 20 seconds
    }

    await ctx.db.patch(gameState._id, updates);

    return { success: true, cost, newEnergy, cellType };
  },
});

function checkAdjacency(grid: any[][], row: number, col: number, playerId: string): boolean {
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  
  // Check if player has any cells at all (for first move)
  let hasAnyCells = false;
  for (const gridRow of grid) {
    for (const cell of gridRow) {
      if (cell.owner === playerId) {
        hasAnyCells = true;
        break;
      }
    }
    if (hasAnyCells) break;
  }

  if (!hasAnyCells) {
    return true; // First cell can be placed anywhere
  }
  
  for (const [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;
    
    if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 10) {
      if (grid[newRow][newCol].owner === playerId) {
        return true;
      }
    }
  }
  
  return false;
}

function countPlayerCells(grid: any[][], playerId: string): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell.owner === playerId) {
        count++;
      }
    }
  }
  return count;
}

function calculateCellCost(cellCount: number): number {
  if (cellCount === 0) return 20; // First cell
  // Improved economy: slower growth to prevent stagnation
  return Math.floor(20 * Math.pow(1.25, cellCount));
}

export const getCellTypes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("cellTypes").collect();
  },
});
