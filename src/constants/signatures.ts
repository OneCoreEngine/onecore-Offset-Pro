export interface Signature {
  name: string;
  pattern: string;
  type: 'function' | 'global_variable' | 'hook' | 'heuristic';
  bypass_use: string;
  ban_fix_action: string;
  confidence?: number;
}

export const LIBRARY_SIGNATURES: Record<string, Signature[]> = {
  'libUE4.so': [
    {
      name: 'GNames',
      pattern: '48 8B 05 ?? ?? ?? ?? 48 8D 0D ?? ?? ?? ?? E8 ?? ?? ?? ?? 48 8B C8',
      type: 'global_variable',
      bypass_use: 'ESP/Wallhack requires this for object names',
      ban_fix_action: 'No patch needed, but verify pointer validity'
    },
    {
      name: 'GUObjectArray',
      pattern: '48 8B 05 ?? ?? ?? ?? 48 8B 0C C8 48 8B 04 D1',
      type: 'global_variable',
      bypass_use: 'Required for iterating all game objects',
      ban_fix_action: 'Monitor for anti-cheat integrity checks'
    },
    {
      name: 'ProcessEvent',
      pattern: '40 55 56 57 41 54 41 55 41 56 41 57 48 81 EC ?? ?? ?? ??',
      type: 'function',
      bypass_use: 'Main game event handler for Silent Aim/ESP',
      ban_fix_action: 'Hook carefully; use trampoline to avoid detection'
    },
    {
      name: 'LocalPlayer',
      pattern: '48 8B 05 ?? ?? ?? ?? 48 8B 88 ?? ?? ?? ?? 48 85 C9 74 ??',
      type: 'global_variable',
      bypass_use: 'Pointer to the local player object',
      ban_fix_action: 'Use for reading health, position, etc.'
    },
    {
      name: 'ViewMatrix',
      pattern: '0F 10 05 ?? ?? ?? ?? 0F 11 01 C3',
      type: 'global_variable',
      bypass_use: 'Required for WorldToScreen calculations',
      ban_fix_action: 'Read-only access recommended'
    },
    {
      name: 'GetActorArray',
      pattern: '48 8B 05 ?? ?? ?? ?? 48 8B 0C C8 48 8B 04 D1',
      type: 'function',
      bypass_use: 'Iterates through all actors in the world',
      ban_fix_action: 'Use for ESP and AimBot'
    },
    {
      name: 'Actors',
      pattern: '48 8B 88 ?? ?? ?? ?? 48 85 C9 74 12',
      type: 'global_variable',
      bypass_use: 'Array of all actors in the current level',
      ban_fix_action: 'Monitor for anti-cheat integrity checks'
    },
    {
      name: 'PostRender',
      pattern: '48 89 5C 24 08 48 89 74 24 10 57 48 83 EC 30 48 8B D9',
      type: 'function',
      bypass_use: 'Main rendering hook for drawing ESP',
      ban_fix_action: 'Hook to draw custom UI elements'
    },
    {
      name: 'GNativeAndroidApp',
      pattern: '48 8B 05 ?? ?? ?? ?? 48 8B 88 ?? ?? ?? ?? 48 85 C9 74 ?? 48 8B 01 FF 50 ??',
      type: 'global_variable',
      bypass_use: 'Android app context for JNI calls',
      ban_fix_action: 'Monitor for anti-cheat environment checks'
    },
    {
      name: 'ShortEvent',
      pattern: '48 89 5C 24 08 48 89 74 24 10 57 48 83 EC 20 48 8B F9 48 8B DA',
      type: 'function',
      bypass_use: 'Optimized event handler for small payloads',
      ban_fix_action: 'Hook if needed for specific game events'
    },
    {
      name: 'MsgBox',
      pattern: '48 89 5C 24 08 48 89 74 24 10 57 48 83 EC 20 48 8B F1 48 8B DA E8 ?? ?? ?? ??',
      type: 'function',
      bypass_use: 'In-game message box display',
      ban_fix_action: 'Bypass to hide anti-cheat warnings'
    },
    {
      name: 'MeshSynData',
      pattern: '48 8B 05 ?? ?? ?? ?? 48 8B 88 ?? ?? ?? ?? 48 85 C9 74 ?? 48 8B 01 FF 50 ?? 48 8B C8',
      type: 'global_variable',
      bypass_use: 'Mesh synchronization data for player models',
      ban_fix_action: 'Use for skeleton/bone ESP'
    }
  ],
  'libanogs.so': [
    {
      name: 'Anti-Cheat Hook 1',
      pattern: 'FF 03 01 D1 F6 57 02 A9 F4 4F 03 A9 FD 7B 04 A9 FD 03 01 91',
      type: 'hook',
      bypass_use: 'Anti-cheat detection point',
      ban_fix_action: 'MUST PATCH: Return 0 or bypass the check'
    },
    {
      name: 'Anti-Cheat Hook 2',
      pattern: 'FF 03 01 D1 F6 57 02 A9 F4 4F 03 A9 FD 7B 04 A9 FD 03 01 91 48 8B 05 ?? ?? ?? ??',
      type: 'hook',
      bypass_use: 'Anti-cheat detection point',
      ban_fix_action: 'MUST PATCH: Return 0 or bypass the check'
    },
    {
      name: 'Security Check 0x51FA14',
      pattern: 'F3 0F 1E F3 48 83 EC 28 48 8B 05 ?? ?? ?? ?? 48 85 C0 74 05',
      type: 'hook',
      bypass_use: 'Internal security integrity check',
      ban_fix_action: 'PATCH: Return 0 (00 00 80 D2 C0 03 5F D6)'
    }
  ],
  'libTBlueData.so': [
    {
      name: 'GetDeviceID',
      pattern: '48 89 5C 24 08 48 89 74 24 10 57 48 83 EC 20 48 8B F1',
      type: 'function',
      bypass_use: 'Collects unique device identifier',
      ban_fix_action: 'SPOOF: Return random ID to avoid hardware ban'
    },
    {
      name: 'EnableDeviceInfo',
      pattern: '48 89 5C 24 08 48 89 74 24 10 57 48 83 EC 20 48 8B F1 48 8B 05 ?? ?? ?? ??',
      type: 'function',
      bypass_use: 'Enables device info collection',
      ban_fix_action: 'PATCH: Return 0 to disable collection'
    },
    {
      name: 'ReportDeviceInfo',
      pattern: '48 83 EC 28 48 8B 05 ?? ?? ?? ?? 48 85 C0 74 0B 48 8B 00 FF 50 10',
      type: 'function',
      bypass_use: 'Sends device info to server',
      ban_fix_action: 'PATCH: Return 0 to prevent reporting'
    }
  ],
  'libRoosterNN.so': [
    {
      name: 'NN_Patch_1',
      pattern: '48 89 5C 24 08 48 89 6C 24 10 48 89 74 24 18 57 48 83 EC 20',
      type: 'hook',
      bypass_use: 'Neural network anti-cheat check',
      ban_fix_action: 'PATCH: Disable to prevent behavioral detection'
    },
    {
      name: 'NN_Patch_2',
      pattern: '48 89 5C 24 08 48 89 6C 24 10 48 89 74 24 18 57 48 83 EC 20 48 8B 05 ?? ?? ?? ??',
      type: 'hook',
      bypass_use: 'Neural network anti-cheat check',
      ban_fix_action: 'PATCH: Disable to prevent behavioral detection'
    },
    {
      name: 'NN_Check_0x11143',
      pattern: '55 48 89 E5 48 83 EC 10 48 89 7D F8 48 8B 45 F8 48 8B 00',
      type: 'hook',
      bypass_use: 'Specific NN behavioral check',
      ban_fix_action: 'PATCH: Return 0 to bypass'
    }
  ]
};
