import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { PlayerList } from "./components/PlayerList";
import { InvitationList } from "./components/InvitationList";
import { GameBoard } from "./components/GameBoard";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-game">
      <header className="sticky top-0 z-50 bg-white/10 backdrop-blur-md h-16 flex justify-between items-center border-b border-white/20 shadow-lg px-4">
        <h2 className="text-xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
          ⚔️ RTS Duel Arena
        </h2>
        <SignOutButton />
      </header>
      <main className="flex-1 p-4">
        <Content />
      </main>
      <Toaster 
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
          }
        }}
      />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const currentPlayer = useQuery(api.players.getCurrentPlayer);
  const [playerName, setPlayerName] = useState("");
  const getOrCreatePlayer = useMutation(api.players.getOrCreatePlayer);

  if (loggedInUser === undefined || currentPlayer === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border-4 border-white/20"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent mb-6 drop-shadow-lg">
          RTS Duel Arena
        </h1>
        <Authenticated>
          <p className="text-xl text-white/90 font-medium">
            Welcome, {loggedInUser?.email ?? "player"}! ✨
          </p>
        </Authenticated>
        <Unauthenticated>
          <p className="text-xl text-white/90 font-medium">Sign in to start dueling ⚔️</p>
        </Unauthenticated>
      </div>

      <Unauthenticated>
        <div className="max-w-md mx-auto">
          <div className="bg-gradient-card rounded-2xl shadow-2xl p-8 border border-white/20">
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>
        {!currentPlayer ? (
          <div className="max-w-md mx-auto">
            <div className="bg-gradient-card rounded-2xl shadow-2xl p-8 border border-white/20">
              <h3 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Choose Your Player Name
              </h3>
              <div className="space-y-4">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Enter your warrior name..."
                  className="w-full px-4 py-3 rounded-xl bg-white/90 backdrop-blur-sm border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all shadow-sm hover:shadow-md"
                />
                <button
                  onClick={() => void getOrCreatePlayer({ name: playerName })}
                  disabled={!playerName.trim()}
                  className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                >
                  Join the Arena! ⚔️
                </button>
              </div>
            </div>
          </div>
        ) : (
          <GameLobby player={currentPlayer} />
        )}
      </Authenticated>
    </div>
  );
}

function GameLobby({ player }: { player: any }) {
  const activeDuel = useQuery(api.game.getActiveDuel, { playerId: player._id });
  const updatePlayerStatus = useMutation(api.players.updatePlayerStatus);

  useEffect(() => {
    // Keep player online
    const interval = setInterval(() => {
      void updatePlayerStatus({ playerId: player._id, isOnline: true });
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [player._id, updatePlayerStatus]);

  if (activeDuel) {
    return <GameBoard duelData={activeDuel} currentPlayer={player} />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-gradient-card rounded-2xl shadow-2xl p-6 border border-white/20">
        <h3 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
          🌟 Online Warriors
        </h3>
        <PlayerList currentPlayer={player} />
      </div>
      
      <div className="bg-gradient-card rounded-2xl shadow-2xl p-6 border border-white/20">
        <h3 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
          ⚔️ Battle Invitations
        </h3>
        <InvitationList playerId={player._id} />
      </div>
    </div>
  );
}
