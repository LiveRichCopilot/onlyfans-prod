"use client";

import { FolderOpen } from "lucide-react";

export function VaultAttach() {
    const handleClick = () => {
        // Will open vault picker to attach from OnlyFans Vault
        console.log("Vault attach clicked");
    };

    return (
        <button
            onClick={handleClick}
            className="p-2 text-gray-400 hover:text-[#0d9488] transition-colors"
            title="Attach from OnlyFans Vault"
        >
            <FolderOpen size={20} />
        </button>
    );
}
