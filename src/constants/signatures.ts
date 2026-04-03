export interface Signature {
  name: string;
  pattern: string;
  type: 'function' | 'global_variable' | 'hook' | 'heuristic';
  bypass_use: string;
  ban_fix_action: string;
  banType: string;
  confidence: number;
}

export const LIBRARY_SIGNATURES: Record<string, Signature[]> = {
  'libUE4.so': [
    {
      name: 'integrity_check',
      pattern: '55 48 8B EC 48 81 EC ?? ?? ?? ?? 48 8B 05 ?? ?? ?? ??',
      type: 'hook',
      bypass_use: 'Game integrity and file verification',
      ban_fix_action: 'PATCH: Return 1 or bypass check',
      banType: '7 day / 1 month',
      confidence: 90
    }
  ],
  'libanogs.so': [
    {
      name: 'ptrace_hook',
      pattern: 'E8 ?? ?? ?? ?? 84 C0 74 ?? 48 8B 05 ?? ?? ?? ??',
      type: 'hook',
      bypass_use: 'Anti-debug ptrace detection',
      ban_fix_action: 'PATCH: Return 0',
      banType: '1-30 min',
      confidence: 90
    },
    {
      name: 'pthread_create_hook',
      pattern: '55 48 8B EC 48 83 EC 20 48 8B 05 ?? ?? ?? ?? 48 33 C4 48 89 45 ??',
      type: 'hook',
      bypass_use: 'Anti-cheat thread creation',
      ban_fix_action: 'PATCH: Return 0',
      banType: '1-30 min',
      confidence: 90
    },
    {
      name: 'fopen_detection',
      pattern: '48 8B 0D ?? ?? ?? ?? 48 85 C9 74 ?? E8 ?? ?? ?? ?? 84 C0 74 ??',
      type: 'hook',
      bypass_use: 'File access monitoring for config checks',
      ban_fix_action: 'PATCH: Redirect or bypass',
      banType: '1 hour / 1 day',
      confidence: 90
    },
    {
      name: 'socket_send',
      pattern: 'E8 ?? ?? ?? ?? 84 C0 74 ?? 48 8B 05 ?? ?? ?? ?? 48 89 45 ??',
      type: 'hook',
      bypass_use: 'Reporting detections to server via socket',
      ban_fix_action: 'PATCH: Return 0',
      banType: '10 year online',
      confidence: 90
    }
  ],
  'libTBlueData.so': [
    {
      name: 'device_collect',
      pattern: '40 53 48 83 EC 20 48 8B D9 E8 ?? ?? ?? ?? 84 C0 74 ?? 48 8B 0D',
      type: 'hook',
      bypass_use: 'Hardware ID and device info collection',
      ban_fix_action: 'SPOOF: Return random ID',
      banType: '10 year / HWID',
      confidence: 90
    },
    {
      name: 'ban_list_check',
      pattern: '48 8B 05 ?? ?? ?? ?? 48 85 C0 74 ?? 80 78 ?? 00 74 ??',
      type: 'hook',
      bypass_use: 'Local blacklist/ban list verification',
      ban_fix_action: 'PATCH: Return 0',
      banType: '10 year offline',
      confidence: 90
    }
  ]
};
