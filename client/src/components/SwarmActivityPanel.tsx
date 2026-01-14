import { useState } from "react";
import {
  Activity,
  Users,
  Vote,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  Cpu,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useSwarmEvents,
  type ActiveNegotiation,
  type ActiveTeam,
  type ActiveConsensus,
  type BidEvent,
  type VoteEvent,
  type SwarmEvent,
} from "@/hooks/useSwarmEvents";

export function SwarmActivityPanel() {
  const {
    activeNegotiations,
    activeTeams,
    activeConsensus,
    recentActivity,
    isConnected,
  } = useSwarmEvents();
  const [isOpen, setIsOpen] = useState(false);

  const hasActivity =
    Object.keys(activeNegotiations).length > 0 ||
    Object.keys(activeTeams).length > 0 ||
    Object.keys(activeConsensus).length > 0 ||
    recentActivity.length > 0;

  if (!hasActivity && !isOpen) {
    return null;
  }

  if (!isConnected) {
    return null;
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="fixed bottom-4 right-4 w-[320px] z-40"
    >
      <Card className="border-l-4 border-l-purple-500 shadow-lg bg-background/95 backdrop-blur-sm">
        <CardHeader className="p-2 flex flex-row items-center justify-between space-y-0">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <BrainCircuit className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-medium">Swarm</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {Object.keys(activeNegotiations).length +
                  Object.keys(activeTeams).length +
                  Object.keys(activeConsensus).length}
              </Badge>
              {isOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <ScrollArea className="h-[300px] p-2 pt-0">
            <div className="space-y-4">
              {Object.keys(activeNegotiations).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider flex items-center gap-1">
                    <Activity className="h-3 w-3" /> Negotiations
                  </h3>
                  {Object.values(activeNegotiations).map(neg => (
                    <NegotiationCard key={neg.taskId} negotiation={neg} />
                  ))}
                </div>
              )}

              {Object.keys(activeTeams).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-green-500 uppercase tracking-wider flex items-center gap-1">
                    <Users className="h-3 w-3" /> Active Teams
                  </h3>
                  {Object.values(activeTeams).map(team => (
                    <TeamCard key={team.teamId} team={team} />
                  ))}
                </div>
              )}

              {Object.keys(activeConsensus).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-purple-500 uppercase tracking-wider flex items-center gap-1">
                    <Vote className="h-3 w-3" /> Consensus
                  </h3>
                  {Object.values(activeConsensus).map(consensus => (
                    <ConsensusCard
                      key={consensus.proposalId}
                      consensus={consensus}
                    />
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Recent Activity
                </h3>
                <div className="space-y-1">
                  {recentActivity.map((event, i) => (
                    <ActivityItem
                      key={`${event.type}-${event.timestamp}-${i}`}
                      event={event}
                    />
                  ))}
                  {recentActivity.length === 0 && (
                    <div className="text-xs text-muted-foreground italic p-2 text-center">
                      No recent swarm activity
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function NegotiationCard({ negotiation }: { negotiation: ActiveNegotiation }) {
  return (
    <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
      <CardContent className="p-3 space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800"
            >
              Negotiating
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {negotiation.bids.length} bids
            </span>
          </div>
          <p className="text-xs font-medium line-clamp-2">
            {negotiation.taskDescription}
          </p>
        </div>

        <div className="space-y-2">
          {negotiation.bids.slice(-3).map(bid => (
            <BidItem key={`${bid.taskId}-${bid.agentId}`} bid={bid} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BidItem({ bid }: { bid: BidEvent }) {
  return (
    <div className="text-xs space-y-1 bg-background/50 p-2 rounded-md animate-in fade-in slide-in-from-right-2 duration-300">
      <div className="flex justify-between items-center">
        <span className="font-medium flex items-center gap-1">
          <Cpu className="h-3 w-3 text-muted-foreground" />
          {bid.agentName}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {Math.round(bid.confidence * 100)}% conf
        </span>
      </div>
      <Progress value={bid.confidence * 100} className="h-1" />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{bid.agentType}</span>
        <span>{bid.estimatedDuration}ms</span>
      </div>
    </div>
  );
}

function TeamCard({ team }: { team: ActiveTeam }) {
  return (
    <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
      <CardContent className="p-3 space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200 dark:border-green-800"
            >
              Team {team.teamId.slice(0, 8)}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {team.members.length} members
            </span>
          </div>
          <p className="text-xs font-medium line-clamp-2">
            {team.taskDescription}
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          {team.members.map(member => (
            <Badge
              key={member.agentId}
              variant="secondary"
              className={cn(
                "text-[10px] gap-1 pr-2 pl-2",
                member.isLeader &&
                  "border-green-400 bg-green-100 dark:bg-green-900"
              )}
            >
              {member.agentName}
              {member.isLeader && <Activity className="h-3 w-3" />}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ConsensusCard({ consensus }: { consensus: ActiveConsensus }) {
  const approvalCount = consensus.votes.filter(
    v => v.vote === "approve"
  ).length;
  const rejectCount = consensus.votes.filter(v => v.vote === "reject").length;
  const totalVotes = consensus.votes.length;
  const approvalPercent =
    totalVotes > 0 ? (approvalCount / totalVotes) * 100 : 0;

  return (
    <Card className="border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
      <CardContent className="p-3 space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-purple-200 dark:border-purple-800"
            >
              Consensus
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {totalVotes}/{consensus.participantCount} votes
            </span>
          </div>
          <p className="text-xs font-medium line-clamp-2">
            {consensus.question}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-green-600 font-medium">
              {approvalCount} Approve
            </span>
            <span className="text-red-600 font-medium">
              {rejectCount} Reject
            </span>
          </div>
          <Progress value={approvalPercent} className="h-1.5" />
        </div>

        {consensus.status === "complete" && consensus.result && (
          <div className="pt-2 border-t border-purple-200 dark:border-purple-800">
            <div className="text-xs font-medium">Decision:</div>
            <p className="text-xs text-muted-foreground">
              {consensus.result.decision}
            </p>
          </div>
        )}

        <div className="space-y-1 max-h-[100px] overflow-y-auto">
          {consensus.votes.slice(-3).map(vote => (
            <VoteItem key={`${vote.proposalId}-${vote.agentId}`} vote={vote} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function VoteItem({ vote }: { vote: VoteEvent }) {
  return (
    <div className="flex items-start gap-2 text-[10px] p-1.5 rounded bg-background/50">
      {vote.vote === "approve" ? (
        <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5" />
      ) : vote.vote === "reject" ? (
        <XCircle className="h-3 w-3 text-red-500 mt-0.5" />
      ) : (
        <HelpCircle className="h-3 w-3 text-gray-500 mt-0.5" />
      )}
      <div className="flex-1">
        <div className="flex justify-between">
          <span className="font-medium">{vote.agentName}</span>
        </div>
        <p className="text-muted-foreground line-clamp-1">{vote.reasoning}</p>
      </div>
    </div>
  );
}

function ActivityItem({ event }: { event: SwarmEvent }) {
  const getIcon = () => {
    switch (event.type) {
      case "negotiation_start":
      case "negotiation_complete":
      case "bid":
        return <Activity className="h-3 w-3 text-blue-500" />;
      case "team_forming":
      case "team_formed":
      case "team_member_added":
        return <Users className="h-3 w-3 text-green-500" />;
      case "consensus_start":
      case "vote":
      case "consensus_complete":
        return <Vote className="h-3 w-3 text-purple-500" />;
      case "broadcast":
        return <MessageSquare className="h-3 w-3 text-orange-500" />;
      default:
        return <BrainCircuit className="h-3 w-3" />;
    }
  };

  const getMessage = () => {
    const d = event.data as Record<string, string | number | undefined>;
    const str = (v: unknown) => (typeof v === "string" ? v : String(v ?? ""));
    const num = (v: unknown) => (typeof v === "number" ? v : 0);

    switch (event.type) {
      case "negotiation_start":
        return `Negotiation started: ${str(d.taskDescription).slice(0, 30)}...`;
      case "bid":
        return `Bid from ${d.agentName} (${Math.round(num(d.confidence) * 100)}%)`;
      case "negotiation_complete":
        return `Winner: ${d.winningAgentName}`;
      case "team_forming":
        return `Team forming for ${str(d.taskDescription).slice(0, 30)}...`;
      case "team_member_added":
        return `${d.agentName} joined team`;
      case "team_formed":
        return `Team formed with ${d.memberCount} members`;
      case "team_disbanded":
        return `Team disbanded`;
      case "consensus_start":
        return `Consensus: ${str(d.question).slice(0, 30)}...`;
      case "vote":
        return `${d.agentName} voted ${d.vote}`;
      case "consensus_complete":
        return `Consensus reached: ${str(d.decision).slice(0, 30)}...`;
      case "broadcast":
        return `${d.fromAgentName}: ${str(d.message).slice(0, 30)}...`;
      default:
        return event.type;
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs py-1 animate-in fade-in slide-in-from-left-2">
      <div className="mt-0.5">{getIcon()}</div>
      <div className="flex-1 truncate text-muted-foreground">
        {getMessage()}
      </div>
      <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap">
        {new Date(event.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </span>
    </div>
  );
}
