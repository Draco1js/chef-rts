import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function PlayerList({ currentPlayer }: { currentPlayer: any }) {
  const onlinePlayers = useQuery(api.players.getOnlinePlayers) || [];
  const sendInvitation = useMutation(api.invitations.sendInvitation);

  const handleInvite = async (playerId: string) => {
    try {
      await sendInvitation({
        fromPlayerId: currentPlayer._id,
        toPlayerId: playerId as any,
      });
      toast.success("Battle invitation sent! ⚔️");
    } catch (error: any) {
      const message = error.message === "Invitation already sent" 
        ? "Already challenged this warrior!" 
        : "Failed to send invitation";
      toast.error(message);
    }
  };

  const otherPlayers = onlinePlayers.filter(p => p._id !== currentPlayer._id);

  return (
    <div className="space-y-3">
      {otherPlayers.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🏜️</div>
          <p className="text-gray-500 font-medium">No other warriors online</p>
          <p className="text-sm text-gray-400 mt-2">Share the arena with friends!</p>
        </div>
      ) : (
        otherPlayers.map((player) => (
          <div key={player._id} className="group flex items-center justify-between p-4 bg-white/60 backdrop-blur-sm rounded-xl hover:bg-white/80 transition-all duration-300 border border-white/30 hover:border-green-300 hover:shadow-lg">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-lg"></div>
                <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
              </div>
              <div>
                <span className="font-bold text-gray-800 group-hover:text-green-700 transition-colors">
                  {player.name}
                </span>
                <div className="text-xs text-green-600 font-medium">⚔️ Ready for battle</div>
              </div>
            </div>
            <button
              onClick={() => handleInvite(player._id)}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white text-sm font-semibold rounded-lg hover:from-green-600 hover:to-blue-600 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
            >
              Challenge! ⚔️
            </button>
          </div>
        ))
      )}
    </div>
  );
}
