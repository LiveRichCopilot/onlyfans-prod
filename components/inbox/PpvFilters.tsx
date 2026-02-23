"use client";

type PurchaseFilter = "all" | "purchased" | "not_purchased";
type TypeFilter = "all" | "mass" | "direct";

type Props = {
    purchaseFilter: PurchaseFilter;
    typeFilter: TypeFilter;
    onPurchaseFilterChange: (f: PurchaseFilter) => void;
    onTypeFilterChange: (f: TypeFilter) => void;
    purchasedCount: number;
    notPurchasedCount: number;
    massCount: number;
    directCount: number;
};

function Chip({
    label,
    count,
    active,
    color,
    onClick,
}: {
    label: string;
    count?: number;
    active: boolean;
    color: "teal" | "purple";
    onClick: () => void;
}) {
    const activeClass =
        color === "teal"
            ? "bg-teal-500/20 text-teal-400 border-teal-500/30"
            : "bg-purple-500/20 text-purple-400 border-purple-500/30";

    return (
        <button
            onClick={onClick}
            className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                active ? activeClass : "bg-white/[0.04] text-white/50 border-white/[0.08] hover:bg-white/[0.08]"
            }`}
        >
            {label}
            {count !== undefined && <span className="ml-1 opacity-60">{count}</span>}
        </button>
    );
}

export function PpvFilters({
    purchaseFilter,
    typeFilter,
    onPurchaseFilterChange,
    onTypeFilterChange,
    purchasedCount,
    notPurchasedCount,
    massCount,
    directCount,
}: Props) {
    return (
        <div className="flex gap-1.5 flex-wrap mb-4">
            <Chip label="All" active={purchaseFilter === "all"} color="teal" onClick={() => onPurchaseFilterChange("all")} />
            <Chip label="Purchased" count={purchasedCount} active={purchaseFilter === "purchased"} color="teal" onClick={() => onPurchaseFilterChange("purchased")} />
            <Chip label="Not Purchased" count={notPurchasedCount} active={purchaseFilter === "not_purchased"} color="teal" onClick={() => onPurchaseFilterChange("not_purchased")} />

            <div className="w-px bg-white/[0.08] mx-0.5 self-stretch" />

            <Chip label="All" active={typeFilter === "all"} color="purple" onClick={() => onTypeFilterChange("all")} />
            <Chip label="Mass" count={massCount} active={typeFilter === "mass"} color="purple" onClick={() => onTypeFilterChange("mass")} />
            <Chip label="Direct" count={directCount} active={typeFilter === "direct"} color="purple" onClick={() => onTypeFilterChange("direct")} />
        </div>
    );
}
