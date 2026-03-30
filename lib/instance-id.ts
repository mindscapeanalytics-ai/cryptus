/**
 * Instance identifier for multi-instance deployments.
 * Generates a unique ID per instance to prevent cache key conflicts.
 */

let instanceId: string | null = null;

/**
 * Get or generate the instance ID.
 * Uses environment variable if available, otherwise generates a random ID.
 */
export function getInstanceId(): string {
  if (instanceId) return instanceId;
  
  // Use environment variable if provided (useful for debugging)
  if (typeof process !== 'undefined' && process.env.INSTANCE_ID) {
    instanceId = process.env.INSTANCE_ID;
    return instanceId;
  }
  
  // Generate random instance ID (8 characters)
  instanceId = Math.random().toString(36).substring(2, 10);
  return instanceId;
}

/**
 * Create a cache key with instance isolation.
 * Format: {baseKey}:inst:{instanceId}
 */
export function createInstanceCacheKey(baseKey: string): string {
  return `${baseKey}:inst:${getInstanceId()}`;
}

/**
 * Extract base key from instance-isolated cache key.
 */
export function extractBaseKey(instanceKey: string): string {
  const parts = instanceKey.split(':inst:');
  return parts[0];
}
