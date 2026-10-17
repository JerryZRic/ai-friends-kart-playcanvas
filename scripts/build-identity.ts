/** CI supplies the exact checked-out commit; no parent lookup or source hash literal. */
export function devBuildVersion(sha?: string, channel = 'dev'): string {
 if(channel==='release')return '1.1.0';
 if(channel!=='dev')throw new Error('Unknown build channel');
 if(sha===undefined||sha==='')return '1.1.0-dev.local';
 if(!/^[a-fA-F0-9]{40}$/.test(sha))throw new Error('DEV_BUILD_SHA must be a full 40-hex commit SHA');
 return `1.1.0-dev.${sha.slice(0,6).toLowerCase()}`;
}

