import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function InvitationList({ playerId }: { playerId: string }) {
  const invitations = useQuery(api.invitations.getInvitations, { playerId: playerId as any }) || [];
  const respondToInvitation = useMutation(api.invitations.respondToInvitation);

  const handleResponse = async (invitationId: string, accept: boolean) => {
    try {
      const duelId = await respondToInvitation({
        invitationId: invitationId as any,
        accept,
      });
      
      if (accept && duelId) {
        toast.success("Battle begins! May the best warrior win! ⚔️");
      } else if (accept) {
        toast.success("Challenge accepted! ✨");
      } else {
        toast.info("Challenge declined 🛡️");
      }
    } catch (error: any) {
      const message = error.message || "Failed to respond";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-3">
      {invitations.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📜</div>
          <p className="text-gray-500 font-medium">No pending challenges</p>
          <p className="text-sm text-gray-400 mt-2">Waiting for brave warriors...</p>
        </div>
      ) : (
        invitations.map((invitation) => (
          <div key={invitation._id} className="group p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl hover:from-yellow-100 hover:to-orange-100 transition-all duration-300 shadow-md hover:shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚔️</span>
                <div>
                  <p className="font-bold text-gray-800">
                    <span className="text-orange-600">{invitation.fromPlayer?.name}</span> challenges you!
                  </p>
                  <p className="text-xs text-gray-600">A duel awaits your response...</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleResponse(invitation._id, true)}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-semibold rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                ⚔️ Accept Challenge
              </button>
              <button
                onClick={() => handleResponse(invitation._id, false)}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg"
              >
                🛡️ Decline
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
