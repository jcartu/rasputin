import { useState, useEffect } from "react";
import { getSocket } from "@/lib/socket";

export interface SwarmEvent {
  type: string;
  timestamp: number;
  data: unknown;
}

export interface NegotiationStartEvent {
  taskId: string;
  taskDescription: string;
  requiredCapabilities: string[];
  timestamp: number;
}

export interface BidEvent {
  taskId: string;
  agentId: string;
  agentName: string;
  agentType: string;
  confidence: number;
  availabilityScore: number;
  experienceScore: number;
  estimatedDuration: number;
  timestamp: number;
}

export interface NegotiationCompleteEvent {
  taskId: string;
  winningAgentId: string;
  winningAgentName: string;
  totalBids: number;
  timestamp: number;
}

export interface TeamFormingEvent {
  teamId: string;
  taskDescription: string;
  requiredCapabilities: string[];
  timestamp: number;
}

export interface TeamMemberAddedEvent {
  teamId: string;
  agentId: string;
  agentName: string;
  agentType: string;
  isLeader: boolean;
  timestamp: number;
}

export interface TeamFormedEvent {
  teamId: string;
  memberCount: number;
  leaderId: string;
  leaderName: string;
  timestamp: number;
}

export interface TeamDisbandedEvent {
  teamId: string;
  timestamp: number;
}

export interface ConsensusStartEvent {
  proposalId: string;
  question: string;
  participantCount: number;
  timestamp: number;
}

export interface VoteEvent {
  proposalId: string;
  agentId: string;
  agentName: string;
  agentType: string;
  vote: "approve" | "reject" | "abstain";
  weight: number;
  reasoning: string;
  timestamp: number;
}

export interface ConsensusCompleteEvent {
  proposalId: string;
  decision: string;
  approvalPercentage: number;
  totalVotes: number;
  timestamp: number;
}

export interface BroadcastEvent {
  teamId: string;
  fromAgentId: string;
  fromAgentName: string;
  message: string;
  timestamp: number;
}

export interface ActiveNegotiation extends NegotiationStartEvent {
  bids: BidEvent[];
}

export interface ActiveTeam extends TeamFormingEvent {
  members: TeamMemberAddedEvent[];
  status: "forming" | "active" | "disbanded";
}

export interface ActiveConsensus extends ConsensusStartEvent {
  votes: VoteEvent[];
  status: "voting" | "complete";
  result?: ConsensusCompleteEvent;
}

interface UseSwarmEventsReturn {
  activeNegotiations: Record<string, ActiveNegotiation>;
  activeTeams: Record<string, ActiveTeam>;
  activeConsensus: Record<string, ActiveConsensus>;
  recentActivity: SwarmEvent[];
  isConnected: boolean;
}

export function useSwarmEvents(): UseSwarmEventsReturn {
  const [activeNegotiations, setActiveNegotiations] = useState<
    Record<string, ActiveNegotiation>
  >({});
  const [activeTeams, setActiveTeams] = useState<Record<string, ActiveTeam>>(
    {}
  );
  const [activeConsensus, setActiveConsensus] = useState<
    Record<string, ActiveConsensus>
  >({});
  const [recentActivity, setRecentActivity] = useState<SwarmEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const addActivity = (type: string, data: { timestamp?: number }) => {
      setRecentActivity(prev => {
        const event: SwarmEvent = {
          type,
          timestamp: data.timestamp || Date.now(),
          data,
        };
        return [event, ...prev].slice(0, 20);
      });
    };

    const onNegotiationStart = (data: NegotiationStartEvent) => {
      setActiveNegotiations(prev => ({
        ...prev,
        [data.taskId]: { ...data, bids: [] },
      }));
      addActivity("negotiation_start", data);
    };

    const onBid = (data: BidEvent) => {
      setActiveNegotiations(prev => {
        const negotiation = prev[data.taskId];
        if (!negotiation) return prev;
        return {
          ...prev,
          [data.taskId]: {
            ...negotiation,
            bids: [...negotiation.bids, data],
          },
        };
      });
      addActivity("bid", data);
    };

    const onNegotiationComplete = (data: NegotiationCompleteEvent) => {
      setActiveNegotiations(prev => {
        const { [data.taskId]: _, ...rest } = prev;
        return rest;
      });
      addActivity("negotiation_complete", data);
    };

    const onTeamForming = (data: TeamFormingEvent) => {
      setActiveTeams(prev => ({
        ...prev,
        [data.teamId]: { ...data, members: [], status: "forming" },
      }));
      addActivity("team_forming", data);
    };

    const onTeamMemberAdded = (data: TeamMemberAddedEvent) => {
      setActiveTeams(prev => {
        const team = prev[data.teamId];
        if (!team) return prev;
        return {
          ...prev,
          [data.teamId]: {
            ...team,
            members: [...team.members, data],
          },
        };
      });
      addActivity("team_member_added", data);
    };

    const onTeamFormed = (data: TeamFormedEvent) => {
      setActiveTeams(prev => {
        const team = prev[data.teamId];
        if (!team) return prev;
        return {
          ...prev,
          [data.teamId]: {
            ...team,
            status: "active",
          },
        };
      });
      addActivity("team_formed", data);
    };

    const onTeamDisbanded = (data: TeamDisbandedEvent) => {
      setActiveTeams(prev => {
        const { [data.teamId]: _, ...rest } = prev;
        return rest;
      });
      addActivity("team_disbanded", data);
    };

    const onConsensusStart = (data: ConsensusStartEvent) => {
      setActiveConsensus(prev => ({
        ...prev,
        [data.proposalId]: { ...data, votes: [], status: "voting" },
      }));
      addActivity("consensus_start", data);
    };

    const onVote = (data: VoteEvent) => {
      setActiveConsensus(prev => {
        const consensus = prev[data.proposalId];
        if (!consensus) return prev;
        return {
          ...prev,
          [data.proposalId]: {
            ...consensus,
            votes: [...consensus.votes, data],
          },
        };
      });
      addActivity("vote", data);
    };

    const onConsensusComplete = (data: ConsensusCompleteEvent) => {
      setActiveConsensus(prev => {
        const consensus = prev[data.proposalId];
        if (!consensus) return prev;
        return {
          ...prev,
          [data.proposalId]: {
            ...consensus,
            status: "complete",
            result: data,
          },
        };
      });
      addActivity("consensus_complete", data);
    };

    const onBroadcast = (data: BroadcastEvent) => {
      addActivity("broadcast", data);
    };

    if (socket.connected) setIsConnected(true);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("swarm:negotiation_start", onNegotiationStart);
    socket.on("swarm:bid", onBid);
    socket.on("swarm:negotiation_complete", onNegotiationComplete);
    socket.on("swarm:team_forming", onTeamForming);
    socket.on("swarm:team_member_added", onTeamMemberAdded);
    socket.on("swarm:team_formed", onTeamFormed);
    socket.on("swarm:team_disbanded", onTeamDisbanded);
    socket.on("swarm:consensus_start", onConsensusStart);
    socket.on("swarm:vote", onVote);
    socket.on("swarm:consensus_complete", onConsensusComplete);
    socket.on("swarm:broadcast", onBroadcast);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("swarm:negotiation_start", onNegotiationStart);
      socket.off("swarm:bid", onBid);
      socket.off("swarm:negotiation_complete", onNegotiationComplete);
      socket.off("swarm:team_forming", onTeamForming);
      socket.off("swarm:team_member_added", onTeamMemberAdded);
      socket.off("swarm:team_formed", onTeamFormed);
      socket.off("swarm:team_disbanded", onTeamDisbanded);
      socket.off("swarm:consensus_start", onConsensusStart);
      socket.off("swarm:vote", onVote);
      socket.off("swarm:consensus_complete", onConsensusComplete);
      socket.off("swarm:broadcast", onBroadcast);
    };
  }, []);

  return {
    activeNegotiations,
    activeTeams,
    activeConsensus,
    recentActivity,
    isConnected,
  };
}
