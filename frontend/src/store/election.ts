import { create } from "zustand";

interface ElectionStore {
	vote?: string;
	setVote: (vote: string) => void;
}

export const useElectionStore = create<ElectionStore>()((set, get) => ({
	setVote: (vote: string) =>
		set((_) => ({
			vote,
		})),
}));
