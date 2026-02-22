"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Activity } from "lucide-react";
import { ProfileHeader } from "@/components/creator-profile/ProfileHeader";
import { StatsGrid } from "@/components/creator-profile/StatsGrid";
import { EarningsChart } from "@/components/creator-profile/EarningsChart";
import { TopFansTable } from "@/components/creator-profile/TopFansTable";
import { WhaleWatcherModule } from "@/components/creator-profile/WhaleWatcherModule";
import { ChatterTargetModule } from "@/components/creator-profile/ChatterTargetModule";

export default function CreatorProfilePage() {
    const params = useParams();
    const creatorId = params.id as string;
    const [creator, setCreator] = useState<any>(null);
    const [stats, setStats] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [whaleTarget, setWhaleTarget] = useState(200);
    const [chatterTarget, setChatterTarget] = useState(100);

    useEffect(() => {
        fetch(`/api/creators/${creatorId}`)
            .then(res => res.json())
            .then(data => {
                setCreator(data.creator);
                if (data.creator) { setWhaleTarget(data.creator.whaleAlertTarget || 200); setChatterTarget(data.creator.hourlyTarget || 100); }
                if (data.stats) setStats(data.stats);
                setLoading(false);
            })
            .catch(err => { console.error("Failed to load creator", err); setLoading(false); });
    }, [creatorId]);

    const saveThreshold = async (field: string, value: number) => {
        await fetch(`/api/creators/${creatorId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) }).catch(console.error);
    };

    if (loading) return <div className="flex min-h-screen items-center justify-center text-white"><div className="animate-spin w-8 h-8 rounded-full border-t-2 border-teal-500 mr-3" />Loading...</div>;
    if (!creator) return <div className="p-8 text-white">Creator not found.</div>;

    return (
        <div className="min-h-screen text-white/90 max-w-7xl mx-auto px-4 py-4 md:px-8 md:py-8">
            <ProfileHeader creator={creator} />
            <StatsGrid stats={stats} />
            <EarningsChart data={stats.dailyChart || []} />
            <TopFansTable today={stats.topFansToday || []} week={stats.topFansWeek || []} month={stats.topFansMonth || []} />

            <h2 className="text-[11px] uppercase tracking-wider text-white/35 font-medium mb-4 px-1 flex items-center gap-2">
                <Activity size={14} className="text-blue-400" /> Active Automations
            </h2>
            <div className="space-y-4 mb-8">
                <WhaleWatcherModule creatorName={creator.name} telegramGroupId={creator.telegramGroupId} whaleTarget={whaleTarget} onWhaleTargetChange={setWhaleTarget} onSave={() => saveThreshold("whaleAlertTarget", whaleTarget)} />
                <ChatterTargetModule creatorName={creator.name} chatterTarget={chatterTarget} onChatterTargetChange={setChatterTarget} onSave={() => saveThreshold("hourlyTarget", chatterTarget)} />
            </div>
        </div>
    );
}
