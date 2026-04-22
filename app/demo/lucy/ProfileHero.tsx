import { BadgeCheck } from "lucide-react";

export function ProfileHero({
  name,
  username,
  avatarUrl,
  headerUrl,
  messageCount,
  saleCount,
  dateRangeLabel,
}: {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
  messageCount: number;
  saleCount: number;
  dateRangeLabel: string;
}) {
  const displayName = name || username || "Creator";
  const handle = username ? `@${username}` : null;
  const banner = headerUrl;
  const avatar = avatarUrl;

  return (
    <header className="mb-8">
      <div className="glass-card rounded-3xl overflow-hidden">
        <div className="relative h-32 sm:h-40 w-full overflow-hidden">
          {banner ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={banner}
              alt=""
              className="w-full h-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-teal-900/40 via-slate-800/60 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
        </div>

        <div className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-10 sm:-mt-12 relative">
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-[#050508] overflow-hidden glass-inset shrink-0">
              {avatar ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatar}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full bg-white/10" />
              )}
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight leading-tight">
                {displayName}
              </h1>
              <BadgeCheck size={20} className="text-teal-300 shrink-0" />
            </div>
            {handle && (
              <div className="mt-0.5 text-sm text-white/50">{handle}</div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="text-[11px] uppercase tracking-widest text-teal-300/80 font-medium">
              Sales DNA brief &middot; private
            </div>
            <p className="mt-2 text-[15px] text-white/75 leading-relaxed">
              What fans actually say before they buy, how {displayName.split(" ")[0]} closes, and
              the voice a bot would need to copy. Built from{" "}
              <span className="text-white font-medium">
                {messageCount.toLocaleString()}
              </span>{" "}
              of her messages and{" "}
              <span className="text-white font-medium">
                {saleCount.toLocaleString()}
              </span>{" "}
              sales of $25+ ({dateRangeLabel}).
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
