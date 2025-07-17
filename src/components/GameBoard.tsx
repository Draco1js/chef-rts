import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function GameBoard({ duelData, currentPlayer }: { duelData: any; currentPlayer: any }) {
  const { duel, gameState, player1, player2 } = duelData;
  const [localGameState, setLocalGameState] = useState(gameState);
  const [animatingCells, setAnimatingCells] = useState<Set<string>>(new Set());
  const [zapAnimations, setZapAnimations] = useState<Set<string>>(new Set());
  const [selectedCellType, setSelectedCellType] = useState<"basic" | "hardened" | "generator" | "zapper">("basic");
  const purchaseCell = useMutation(api.game.purchaseCell);
  const updateGameState = useMutation(api.game.updateGameState);

  const isPlayer1 = duel.player1Id === currentPlayer._id;
  const opponent = isPlayer1 ? player2 : player1;
  const playerEnergy = isPlayer1 ? localGameState.player1Energy : localGameState.player2Energy;
  const playerTimer = isPlayer1 ? localGameState.player1Timer : localGameState.player2Timer;
  const opponentEnergy = isPlayer1 ? localGameState.player2Energy : localGameState.player1Energy;
  const opponentTimer = isPlayer1 ? localGameState.player2Timer : localGameState.player1Timer;

  useEffect(() => {
    setLocalGameState(gameState);
  }, [gameState]);

  useEffect(() => {
    // Update game state every second
    const interval = setInterval(async () => {
      try {
        const updated = await updateGameState({
          duelId: duel._id,
          playerId: currentPlayer._id,
        });
        
        if (updated.winnerId) {
          const winner = updated.winnerId === currentPlayer._id ? "You" : opponent.name;
          toast.success(`${winner} won the duel!`);
        }
        
        setLocalGameState((prev: any) => ({
          ...prev,
          ...updated,
          grid: updated.gridChanged || prev.grid,
        }));
      } catch (error) {
        console.error("Failed to update game state:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [duel._id, currentPlayer._id, updateGameState, opponent.name]);

  const handleCellClick = async (row: number, col: number) => {
    const cell = localGameState.grid[row][col];
    const cellKey = `${row}-${col}`;
    
    if (cell.owner === currentPlayer._id) {
      return; // Already owned
    }

    if (cell.owner && cell.owner !== currentPlayer._id && cell.type === "hardened") {
      toast.error("Cannot capture hardened cells");
      return;
    }

    // Add animation
    setAnimatingCells(prev => new Set(prev).add(cellKey));
    setTimeout(() => {
      setAnimatingCells(prev => {
        const newSet = new Set(prev);
        newSet.delete(cellKey);
        return newSet;
      });
    }, 600);

    try {
      // When capturing enemy cells, always convert to basic type
      const cellTypeToUse = (cell.owner && cell.owner !== currentPlayer._id) ? "basic" : selectedCellType;
      
      const result = await purchaseCell({
        duelId: duel._id,
        playerId: currentPlayer._id,
        row,
        col,
        cellType: cellTypeToUse,
      });
      
      const action = cell.owner ? "captured" : "claimed";
      toast.success(`Cell ${action} for ${result.cost} energy!`);
    } catch (error: any) {
      const message = error.message || "Failed to purchase cell";
      toast.error(message);
    }
  };

  const getCellColor = (cell: any, row: number, col: number) => {
    const cellKey = `${row}-${col}`;
    const isAnimating = animatingCells.has(cellKey);
    const isZapping = zapAnimations.has(cellKey);
    
    if (!cell.owner) {
      return `bg-gradient-to-br from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 border-gray-300 ${isAnimating ? 'animate-bounce' : ''}`;
    }
    
    let baseColor = "";
    if (cell.owner === currentPlayer._id) {
      if (cell.type === "hardened") {
        baseColor = "bg-gradient-to-br from-blue-800 to-blue-900 hover:from-blue-900 hover:to-blue-950 border-blue-900 shadow-blue-500/30";
      } else if (cell.type === "generator") {
        baseColor = "bg-gradient-to-br from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 border-blue-500 shadow-blue-400/40 animate-pulse";
      } else if (cell.type === "zapper") {
        baseColor = "bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 border-purple-700 shadow-purple-500/40";
      } else {
        baseColor = "bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-blue-600 shadow-blue-400/30";
      }
    } else {
      if (cell.type === "hardened") {
        baseColor = "bg-gradient-to-br from-red-800 to-red-900 hover:from-red-900 hover:to-red-950 border-red-900 shadow-red-500/30";
      } else if (cell.type === "generator") {
        baseColor = "bg-gradient-to-br from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 border-red-500 shadow-red-400/40 animate-pulse";
      } else if (cell.type === "zapper") {
        baseColor = "bg-gradient-to-br from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 border-pink-700 shadow-pink-500/40";
      } else {
        baseColor = "bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-red-600 shadow-red-400/30";
      }
    }
    
    return `${baseColor} shadow-lg ${isAnimating ? 'animate-bounce scale-110' : ''} ${isZapping ? 'animate-ping' : ''}`;
  };

  const getCellCost = (row: number, col: number) => {
    const cell = localGameState.grid[row][col];
    if (cell.owner === currentPlayer._id) return null;
    if (cell.owner && cell.owner !== currentPlayer._id && cell.type === "hardened") return null;
    
    const playerCells = localGameState.grid.flat().filter((c: any) => c.owner === currentPlayer._id).length;
    const baseCost = Math.floor(20 * Math.pow(1.25, playerCells));
    
    if (cell.owner && cell.owner !== currentPlayer._id) {
      // Capturing enemy cell costs double the base expansion cost regardless of selected cell type
      return baseCost * 2;
    }
    
    // Expanding to neutral cell - use selected cell type pricing
    if (selectedCellType === "hardened") {
      return 700 + baseCost;
    } else if (selectedCellType === "generator") {
      return baseCost + 100;
    } else if (selectedCellType === "zapper") {
      return baseCost + 500;
    }
    
    return baseCost;
  };

  const canAffordCell = (row: number, col: number) => {
    const cost = getCellCost(row, col);
    return cost !== null && cost <= playerEnergy;
  };

  const isAdjacent = (row: number, col: number) => {
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const playerCells = localGameState.grid.flat().filter((c: any) => c.owner === currentPlayer._id).length;
    
    if (playerCells === 0) return true; // First cell
    
    for (const [dr, dc] of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow >= 0 && newRow < 10 && newCol >= 0 && newCol < 10) {
        if (localGameState.grid[newRow][newCol].owner === currentPlayer._id) {
          return true;
        }
      }
    }
    return false;
  };

  const formatTime = (ms: number) => {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return `${seconds}s`;
  };

  const getCellIcon = (cell: any) => {
    if (cell.type === "hardened") return "🛡️";
    if (cell.type === "generator") return "⚡";
    if (cell.type === "zapper") return "🔮";
    return "";
  };

  const getGeneratorTimeLeft = (cell: any) => {
    if (cell.type !== "generator" || !cell.purchasedAt) return null;
    const elapsed = Date.now() - cell.purchasedAt;
    const remaining = Math.max(0, 20000 - elapsed);
    return Math.ceil(remaining / 1000);
  };

  const getZapperCooldown = (cell: any) => {
    if (cell.type !== "zapper" || !cell.purchasedAt) return null;
    const timeSinceLastZap = cell.lastZapTime ? Date.now() - cell.lastZapTime : Date.now() - cell.purchasedAt;
    const remaining = Math.max(0, 5000 - timeSinceLastZap);
    return Math.ceil(remaining / 1000);
  };

  const playerCells = localGameState.grid.flat().filter((c: any) => c.owner === currentPlayer._id).length;
  const opponentCells = localGameState.grid.flat().filter((c: any) => c.owner === opponent._id).length;
  
  // Calculate energy rates with exponential generator scaling
  let playerEnergyRate = 0;
  let opponentEnergyRate = 0;
  let playerGenerators = 0;
  let opponentGenerators = 0;
  
  localGameState.grid.flat().forEach((cell: any) => {
    if (cell.owner === currentPlayer._id) {
      if (cell.type === "basic") playerEnergyRate += 10;
      else if (cell.type === "hardened") playerEnergyRate += 40;
      else if (cell.type === "generator") playerGenerators++;
      else if (cell.type === "zapper") playerEnergyRate += 30;
    } else if (cell.owner === opponent._id) {
      if (cell.type === "basic") opponentEnergyRate += 10;
      else if (cell.type === "hardened") opponentEnergyRate += 40;
      else if (cell.type === "generator") opponentGenerators++;
      else if (cell.type === "zapper") opponentEnergyRate += 30;
    }
  });

  // Apply exponential generator scaling
  if (playerGenerators > 0) {
    const generatorMultiplier = Math.pow(1.5, playerGenerators - 1);
    playerEnergyRate += Math.floor(50 * playerGenerators * generatorMultiplier);
  }
  if (opponentGenerators > 0) {
    const generatorMultiplier = Math.pow(1.5, opponentGenerators - 1);
    opponentEnergyRate += Math.floor(50 * opponentGenerators * generatorMultiplier);
  }

  if (duel.status === "completed") {
    const winner = duel.winnerId === currentPlayer._id ? "You" : opponent.name;
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-2xl p-8 text-center border border-gray-200">
          <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {duel.winnerId === currentPlayer._id ? "🎉 Victory!" : "💔 Defeat"}
          </h2>
          <p className="text-2xl text-gray-700 mb-8 font-medium">{winner} won the duel!</p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg font-semibold text-lg"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4">
      {/* Mobile-optimized stats panel */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 shadow-inner">
            <h3 className="font-bold text-lg mb-3 text-blue-900">{currentPlayer.name} (You)</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-white/60 rounded-lg p-2">
                <div className="text-xs text-blue-700 font-medium">Energy</div>
                <div className="font-mono font-bold text-blue-800 text-lg">{Math.floor(playerEnergy)}</div>
              </div>
              <div className="bg-white/60 rounded-lg p-2">
                <div className="text-xs text-green-700 font-medium">Production</div>
                <div className="font-mono text-green-800 font-bold">+{playerEnergyRate}/s</div>
              </div>
              <div className="bg-white/60 rounded-lg p-2">
                <div className="text-xs text-blue-700 font-medium">Cells</div>
                <div className="font-mono font-bold text-blue-800">{playerCells}</div>
              </div>
              <div className="bg-white/60 rounded-lg p-2">
                <div className="text-xs text-red-700 font-medium">Timer</div>
                <div className="font-mono font-bold text-red-800">{formatTime(playerTimer)}</div>
              </div>
            </div>
            {playerGenerators > 0 && (
              <div className="mt-2 text-xs text-purple-700 font-medium bg-purple-100 rounded-lg p-2">
                ⚡ {playerGenerators} Generators (×{Math.pow(1.5, playerGenerators - 1).toFixed(1)} multiplier)
              </div>
            )}
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl border border-red-200 shadow-inner">
            <h3 className="font-bold text-lg mb-3 text-red-900">{opponent.name}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-white/60 rounded-lg p-2">
                <div className="text-xs text-red-700 font-medium">Energy</div>
                <div className="font-mono font-bold text-red-800 text-lg">{Math.floor(opponentEnergy)}</div>
              </div>
              <div className="bg-white/60 rounded-lg p-2">
                <div className="text-xs text-green-700 font-medium">Production</div>
                <div className="font-mono text-green-800 font-bold">+{opponentEnergyRate}/s</div>
              </div>
              <div className="bg-white/60 rounded-lg p-2">
                <div className="text-xs text-red-700 font-medium">Cells</div>
                <div className="font-mono font-bold text-red-800">{opponentCells}</div>
              </div>
              <div className="bg-white/60 rounded-lg p-2">
                <div className="text-xs text-red-700 font-medium">Timer</div>
                <div className="font-mono font-bold text-red-800">{formatTime(opponentTimer)}</div>
              </div>
            </div>
            {opponentGenerators > 0 && (
              <div className="mt-2 text-xs text-purple-700 font-medium bg-purple-100 rounded-lg p-2">
                ⚡ {opponentGenerators} Generators (×{Math.pow(1.5, opponentGenerators - 1).toFixed(1)} multiplier)
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Cell Type Selector */}
        <div className="mb-4 sm:mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
          <h4 className="font-bold mb-3 text-gray-800 text-center">Select Cell Type</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => setSelectedCellType("basic")}
              className={`p-3 rounded-xl text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                selectedCellType === "basic" 
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg" 
                  : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
              }`}
            >
              <div className="font-bold">Basic</div>
              <div className="text-xs opacity-80">10/s</div>
            </button>
            <button
              onClick={() => setSelectedCellType("hardened")}
              className={`p-3 rounded-xl text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                selectedCellType === "hardened" 
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg" 
                  : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
              }`}
            >
              <div className="font-bold">🛡️ Hardened</div>
              <div className="text-xs opacity-80">700+base, 40/s</div>
            </button>
            <button
              onClick={() => setSelectedCellType("generator")}
              className={`p-3 rounded-xl text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                selectedCellType === "generator" 
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg" 
                  : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
              }`}
            >
              <div className="font-bold">⚡ Generator</div>
              <div className="text-xs opacity-80">+100, 20s expire</div>
            </button>
            <button
              onClick={() => setSelectedCellType("zapper")}
              className={`p-3 rounded-xl text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                selectedCellType === "zapper" 
                  ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-lg" 
                  : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200"
              }`}
            >
              <div className="font-bold">🔮 Zapper</div>
              <div className="text-xs opacity-80">+500, 30/s, zaps</div>
            </button>
          </div>
        </div>

        {/* Enhanced Game Board */}
        <div className="perspective-1000 mb-4">
          <div className="grid grid-cols-10 gap-1 max-w-lg mx-auto transform-gpu" style={{ transform: 'rotateX(10deg) rotateY(-3deg)' }}>
            {localGameState.grid.map((row: any[], rowIndex: number) =>
              row.map((cell: any, colIndex: number) => {
                const cost = getCellCost(rowIndex, colIndex);
                const canAfford = canAffordCell(rowIndex, colIndex);
                const adjacent = isAdjacent(rowIndex, colIndex);
                const canPurchase = cost !== null && canAfford && adjacent;
                const generatorTimeLeft = getGeneratorTimeLeft(cell);
                const zapperCooldown = getZapperCooldown(cell);
                
                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    className={`
                      aspect-square text-xs font-mono border-2 transition-all duration-300 transform-gpu relative overflow-hidden
                      ${getCellColor(cell, rowIndex, colIndex)}
                      ${cell.owner === currentPlayer._id ? 'cursor-default' : canPurchase ? 'cursor-pointer hover:scale-110 hover:z-10' : 'cursor-not-allowed opacity-60'}
                      ${canPurchase ? 'hover:shadow-2xl' : ''}
                    `}
                    disabled={cell.owner === currentPlayer._id || !canPurchase}
                    title={
                      cost && adjacent 
                        ? `Cost: ${cost} energy${canAfford ? '' : ' (insufficient energy)'}${cell.owner && cell.owner !== currentPlayer._id ? ' (capture as basic)' : selectedCellType !== 'basic' ? ` (${selectedCellType})` : ''}` 
                        : cost && !adjacent 
                        ? 'Must expand from adjacent territory'
                        : undefined
                    }
                  >
                    <div className="flex flex-col items-center justify-center h-full relative z-10">
                      <span className="text-lg mb-1">{getCellIcon(cell)}</span>
                      {canPurchase && <span className="text-xs font-bold bg-black/20 rounded px-1">{cost}</span>}
                      {generatorTimeLeft && (
                        <span className="text-xs text-yellow-300 font-bold bg-black/30 rounded px-1">{generatorTimeLeft}s</span>
                      )}
                      {zapperCooldown && zapperCooldown > 0 && (
                        <span className="text-xs text-purple-300 font-bold bg-black/30 rounded px-1">{zapperCooldown}s</span>
                      )}
                    </div>
                    {/* Animated background for special cells */}
                    {cell.type === "generator" && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/20 to-transparent animate-pulse"></div>
                    )}
                    {cell.type === "zapper" && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/20 to-transparent animate-pulse"></div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Enhanced Game Info */}
        <div className="text-center text-sm text-gray-600 space-y-2 bg-gray-50 rounded-xl p-4">
          <p className="font-medium text-gray-800">🎯 Expand your territory or capture enemy cells</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <p>⚡ Basic: 10/s • 🛡️ Hardened: 40/s, uncapturable</p>
            <p>⚡ Generator: 50/s×multiplier, 20s • 🔮 Zapper: 30/s, zaps every 5s</p>
          </div>
          <p className="text-xs text-red-600 font-medium">⏰ You have 20 seconds after each move or you lose</p>
          <p className="text-xs text-purple-600 font-medium">🔮 Zappers convert friendly cells to generators, capture enemy cells in 4×4 radius</p>
        </div>
      </div>
    </div>
  );
}
