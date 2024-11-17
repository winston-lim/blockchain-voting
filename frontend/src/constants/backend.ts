/**
 * APIs
 */
export const BACKEND_BASE_URL = "http://localhost:3001";
export const GET_ENV_API = `${BACKEND_BASE_URL}/getEnv`;
export const GENERATE_CODE_CHALLENGE_API = `${BACKEND_BASE_URL}/generateCodeChallenge`;
export const GET_PERSONAL_DATA_API = `${BACKEND_BASE_URL}/getPersonData`;
export const FETCH_ELECTION_INFO = `${BACKEND_BASE_URL}/api/elections`;

export const HASH_METHOD = "S256";

export const COOKIE_NAMES = ["sid", "code"];
