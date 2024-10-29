export type PersonalInformationData = {
	uinfin?: {
		lastupdated?: string;
		source?: string;
		classification?: string;
		value?: string;
	};
	name?: {
		lastupdated?: string;
		source?: string;
		classification?: string;
		value?: string;
	};
	sex?: {
		lastupdated?: string;
		code?: string;
		source?: string;
		classification?: string;
		desc?: string;
	};
	race?: {
		lastupdated?: string;
		code?: string;
		source?: string;
		classification?: string;
		desc?: string;
	};
	nationality?: {
		lastupdated?: string;
		code?: string;
		source?: string;
		classification?: string;
		desc?: string;
	};
	dob?: {
		lastupdated?: string;
		source?: string;
		classification?: string;
		value?: string;
	};
	email?: {
		lastupdated?: string;
		source?: string;
		classification?: string;
		value?: string;
	};
	mobileno?: {
		lastupdated?: string;
		source?: string;
		classification?: string;
		areacode?: {
			value?: string;
		};
		prefix?: {
			value?: string;
		};
		nbr?: {
			value?: string;
		};
	};
	regadd?: {
		country?: {
			code?: string;
			desc?: string;
		};
		unit?: {
			value?: string;
		};
		street?: {
			value?: string;
		};
		lastupdated?: string;
		block?: {
			value?: string;
		};
		source?: string;
		postal?: {
			value?: string;
		};
		classification?: string;
		floor?: {
			value?: string;
		};
		type?: string;
		building?: {
			value?: string;
		};
	};
	housingtype?: {
		lastupdated?: string;
		code?: string;
		source?: string;
		classification?: string;
		desc?: string;
	};
	hdbtype?: {
		lastupdated?: string;
		code?: string;
		source?: string;
		classification?: string;
		desc?: string;
	};
	marital?: {
		lastupdated?: string;
		code?: string;
		source?: string;
		classification?: string;
		desc?: string;
	};
	edulevel?: {
		lastupdated?: string;
		code?: string;
		source?: string;
		classification?: string;
		desc?: string;
	};
	noaBasic?: {
		yearofassessment?: {
			value?: string;
		};
		lastupdated?: string;
		amount?: {
			value?: number;
		};
		source?: string;
		classification?: string;
	};
	ownerprivate?: {
		lastupdated?: string;
		source?: string;
		classification?: string;
		value?: boolean;
	};
	cpfcontributions?: {
		lastupdated?: string;
		source?: string;
		history?: Array<{
			date?: {
				value?: string;
			};
			employer?: {
				value?: string;
			};
			amount?: {
				value?: number;
			};
			month?: {
				value?: string;
			};
		}>;
		classification?: string;
	};
	cpfbalances?: {
		oa?: {
			lastupdated?: string;
			source?: string;
			classification?: string;
			value?: number;
		};
		ma?: {
			lastupdated?: string;
			source?: string;
			classification?: string;
			value?: number;
		};
		sa?: {
			lastupdated?: string;
			source?: string;
			classification?: string;
			value?: number;
		};
		ra?: {
			lastupdated?: string;
			source?: string;
			classification?: string;
			unavailable?: boolean;
		};
	};
};
